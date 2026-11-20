import type postgres from "postgres";
import { sql } from "./db";
import { raiseAlert } from "./alerts";
import { formatDate, todayISO } from "./labels";
import { audit } from "./audit";
import { UserError } from "./actions";
import { convertCents, formatMoney, formatRate, type Currency } from "./money";
import type { PaymentMethod } from "./labels";

export type PaymentInput = {
  schoolId: string;
  userId: string;
  studentId: string;
  feeId: string;
  amountCents: bigint;
  method: PaymentMethod;
  transactionNumber: string | null;
  paymentDate: string;
  comment: string | null;
  /** Devise dans laquelle le parent a payé, si ce n'est pas celle du frais ; amountCents est alors dans cette devise. */
  paidCurrency?: Currency;
  /** Taux du jour en centièmes de franc pour 1 dollar, obligatoire si paidCurrency diffère de la devise du frais. */
  rate?: bigint | null;
  imported?: boolean;
  /** Le caissier a vu l'avertissement « déjà payé aujourd'hui » et confirme qu'il s'agit d'un autre paiement. */
  confirmDuplicate?: boolean;
  batchId?: string | null;
};

export type PaymentWarning = { level: "info" | "warning" | "danger"; text: string };

export type PaymentCheck = {
  feeName: string;
  feeCurrency: Currency;
  feeAmount: bigint;
  dueDate: Date | null;
  credited: bigint;
  remainingBefore: bigint;
  remainingAfter: bigint;
  converted: boolean;
  advance: boolean;
  warnings: PaymentWarning[];
  /** Reçus déjà émis pour le même élève et le même frais, le même jour ou avec le même montant ces 3 derniers jours. */
  duplicates: { receipt_number: string; amount_cents: bigint; currency: Currency; payment_date: Date; agent: string }[];
  /** Alertes à transmettre au directeur si le paiement est enregistré malgré les avertissements. */
  alerts: { kind: "doublon" | "montant" | "taux" | "date"; title: string }[];
};

const DAY = 86_400_000;

/**
 * Vérifie un paiement avant de l'enregistrer : erreurs bloquantes (UserError) et avertissements
 * montrés sur l'écran de confirmation (doublon possible, taux ou montant inhabituel, date ancienne, avance).
 */
export async function checkPayment(tx: postgres.Sql | postgres.TransactionSql, input: PaymentInput): Promise<PaymentCheck> {
  const [student] = await tx<{ class_id: string | null; status: string }[]>`
    select class_id, status from students where id = ${input.studentId} and school_id = ${input.schoolId}`;
  if (!student) throw new UserError("Élève introuvable.");
  if (student.status !== "active") throw new UserError("Cet élève n'est plus actif : réactivez-le avant d'encaisser.");

  const [fee] = await tx<{ amount_cents: bigint; currency: Currency; class_id: string | null; archived: boolean;
                           optional: boolean; name: string; has_override: boolean; due_date: Date | null }[]>`
    select coalesce(o.amount_cents, f.amount_cents) as amount_cents, f.currency, f.class_id, f.archived,
           f.optional, f.name, o.fee_id is not null as has_override, f.due_date
    from fees f
    left join student_fee_overrides o on o.fee_id = f.id and o.student_id = ${input.studentId}
    where f.id = ${input.feeId} and f.school_id = ${input.schoolId}`;
  if (!fee) throw new UserError("Frais introuvable.");

  const [{ paid }] = await tx<{ paid: bigint }[]>`
    select coalesce(sum(amount_cents), 0)::bigint as paid from payments
    where student_id = ${input.studentId} and fee_id = ${input.feeId} and status = 'valid'`;
  const applies = fee.has_override || (!fee.archived && !fee.optional && (fee.class_id === null || fee.class_id === student.class_id));
  if (!applies && paid === BigInt(0)) {
    throw new UserError(fee.optional
      ? `L'élève n'est pas inscrit au frais optionnel « ${fee.name} ». Inscrivez-le depuis sa fiche.`
      : "Ce frais ne concerne pas la classe de cet élève.");
  }

  // Paiement dans l'autre devise : on crédite le frais de l'équivalent au taux du jour.
  const converted = input.paidCurrency !== undefined && input.paidCurrency !== fee.currency;
  if (converted && !input.rate) throw new UserError("Indiquez le taux du jour (francs pour 1 dollar).");
  let credited = converted ? convertCents(input.amountCents, input.paidCurrency!, fee.currency, input.rate!) : input.amountCents;
  if (credited <= BigInt(0)) throw new UserError("Le montant converti est nul : vérifiez le montant et le taux.");

  const remaining = fee.amount_cents - paid;
  if (remaining <= BigInt(0)) {
    throw new UserError(fee.amount_cents === BigInt(0)
      ? `L'élève est exempté de « ${fee.name} » : rien à encaisser.`
      : `« ${fee.name} » est déjà entièrement payé pour cet élève.`);
  }
  // L'arrondi de conversion peut dépasser le reste d'un centime (ou d'un taux en francs) : on solde le frais.
  const tolerance = converted ? (fee.currency === "USD" ? BigInt(1) : input.rate! / BigInt(100) + BigInt(100)) : BigInt(0);
  if (credited > remaining && credited - remaining <= tolerance) credited = remaining;
  if (credited > remaining) {
    const max = converted ? convertCents(remaining, fee.currency, input.paidCurrency!, input.rate!) : remaining;
    throw new UserError(
      `Le montant dépasse le reste à payer pour « ${fee.name} » : ${formatMoney(remaining, fee.currency)} maximum` +
        (converted ? `, soit ${formatMoney(max, input.paidCurrency!)} au taux de ${formatRate(input.rate!)}.` : "."),
    );
  }

  // Un numéro de transaction Mobile Money ou de virement ne sert qu'une fois.
  if (input.transactionNumber) {
    const [used] = await tx<{ receipt_number: string }[]>`
      select receipt_number from payments
      where school_id = ${input.schoolId} and status = 'valid' and lower(transaction_number) = ${input.transactionNumber.toLowerCase()}
      limit 1`;
    if (used) {
      throw new UserError(`Le n° de transaction ${input.transactionNumber} figure déjà sur le reçu ${used.receipt_number}. Vérifiez le message Mobile Money ou de la banque.`);
    }
  }

  const warnings: PaymentWarning[] = [];
  const alerts: PaymentCheck["alerts"] = [];
  const paidLabel = formatMoney(input.amountCents, input.paidCurrency ?? fee.currency);

  const duplicates = input.imported ? [] : await tx<PaymentCheck["duplicates"]>`
    select p.receipt_number, p.amount_cents, p.currency, p.payment_date, u.name as agent
    from payments p join users u on u.id = p.recorded_by
    where p.student_id = ${input.studentId} and p.fee_id = ${input.feeId} and p.status = 'valid'
      and (p.payment_date = ${input.paymentDate}
           or (p.amount_cents = ${credited.toString()} and p.created_at > now() - interval '3 days'))
    order by p.created_at desc limit 3`;
  if (duplicates.length) {
    const d = duplicates[0];
    warnings.push({
      level: "danger",
      text: `Doublon possible : « ${fee.name} » a déjà été encaissé pour cet élève (reçu ${d.receipt_number}, ` +
        `${formatMoney(d.amount_cents, d.currency)}, ${formatDate(d.payment_date)}, par ${d.agent}). ` +
        "Ne continuez que si le parent paie vraiment une deuxième fois.",
    });
    alerts.push({ kind: "doublon", title: `Paiement possiblement saisi deux fois : « ${fee.name} » (déjà sur le reçu ${d.receipt_number})` });
  }

  if (converted) {
    const [{ last_exchange_rate: last }] = await tx<{ last_exchange_rate: string | null }[]>`
      select last_exchange_rate from schools where id = ${input.schoolId}`;
    const rate = Number(input.rate!) / 100;
    if (last && Math.abs(rate - Number(last)) / Number(last) > 0.1) {
      warnings.push({
        level: "warning",
        text: `Le taux saisi (${formatRate(input.rate!)}) est très différent du dernier taux utilisé (${formatRate(last)}). Vérifiez qu'il n'y a pas un zéro en trop ou en moins.`,
      });
      alerts.push({ kind: "taux", title: `Taux inhabituel : ${formatRate(input.rate!)} (dernier taux : ${formatRate(last)})` });
    }
    // Un montant en francs plus petit que le taux ressemble à un montant en dollars.
    if (input.paidCurrency === "CDF" && input.amountCents < input.rate!) {
      warnings.push({ level: "warning", text: `${paidLabel} vaut moins d'un dollar. Le parent a-t-il payé en dollars ? Choisissez alors « Dollars ».` });
    }
  }

  // Montant très faible par rapport au frais : souvent un zéro oublié (2 500 au lieu de 25 000).
  if (fee.amount_cents > BigInt(0) && credited * BigInt(10) < fee.amount_cents && credited < remaining) {
    warnings.push({
      level: "warning",
      text: `Montant très faible : ${formatMoney(credited, fee.currency)} sur un frais de ${formatMoney(fee.amount_cents, fee.currency)}. Vérifiez les zéros.`,
    });
    alerts.push({ kind: "montant", title: `Petit montant encaissé : ${formatMoney(credited, fee.currency)} sur « ${fee.name} » (${formatMoney(fee.amount_cents, fee.currency)})` });
  }

  const ageDays = Math.round((Date.parse(todayISO()) - Date.parse(input.paymentDate)) / DAY);
  if (!input.imported && ageDays > 30) {
    warnings.push({ level: "warning", text: `La date du paiement remonte à ${ageDays} jours. Vérifiez la date choisie.` });
    alerts.push({ kind: "date", title: `Paiement enregistré avec une date ancienne (${formatDate(input.paymentDate)})` });
  }

  const dueISO = fee.due_date ? new Date(fee.due_date).toISOString().slice(0, 10) : null;
  const advance = dueISO !== null && dueISO > input.paymentDate && Date.parse(dueISO) - Date.parse(input.paymentDate) > 7 * DAY;
  if (advance) warnings.push({ level: "info", text: `Paiement d'avance : la date limite de ce frais est le ${formatDate(fee.due_date)}.` });
  if (credited < remaining) {
    warnings.push({ level: "info", text: `Paiement partiel : il restera ${formatMoney(remaining - credited, fee.currency)} à payer sur ce frais.` });
  }

  return {
    feeName: fee.name, feeCurrency: fee.currency, feeAmount: fee.amount_cents, dueDate: fee.due_date,
    credited, remainingBefore: remaining, remainingAfter: remaining - credited, converted, advance,
    warnings, duplicates, alerts,
  };
}

/** Message d'erreur quand un doublon possible n'a pas été confirmé par le caissier. */
export class DuplicatePaymentError extends UserError {}

async function recordPaymentTx(tx: postgres.TransactionSql, input: PaymentInput): Promise<string> {
  // Un verrou par élève évite deux encaissements simultanés qui dépasseraient le montant dû.
  await tx`select pg_advisory_xact_lock(hashtext(${input.studentId}))`;
  const check = await checkPayment(tx, input);
  if (check.duplicates.length && !input.confirmDuplicate) {
    throw new DuplicatePaymentError(check.warnings.find((w) => w.level === "danger")!.text);
  }
  const { credited, converted } = check;

  const [school] = await tx<{ receipt_counter: number; receipt_prefix: string }[]>`
    update schools set receipt_counter = receipt_counter + 1 where id = ${input.schoolId}
    returning receipt_counter, receipt_prefix`;
  const receiptNumber = `${school.receipt_prefix}-${input.paymentDate.slice(0, 4)}-${String(school.receipt_counter).padStart(6, "0")}`;

  const [payment] = await tx<{ id: string }[]>`
    insert into payments (school_id, student_id, fee_id, amount_cents, currency, payment_method,
                          transaction_number, receipt_number, payment_date, recorded_by, comment,
                          received_cents, received_currency, exchange_rate, imported, batch_id)
    values (${input.schoolId}, ${input.studentId}, ${input.feeId}, ${credited.toString()}, ${check.feeCurrency},
            ${input.method}, ${input.transactionNumber}, ${receiptNumber}, ${input.paymentDate},
            ${input.userId}, ${input.comment},
            ${converted ? input.amountCents.toString() : null}, ${converted ? input.paidCurrency! : null},
            ${converted ? (Number(input.rate!) / 100).toFixed(2) : null}, ${input.imported ?? false}, ${input.batchId ?? null})
    returning id`;
  if (converted) {
    await tx`update schools set last_exchange_rate = ${(Number(input.rate!) / 100).toFixed(2)} where id = ${input.schoolId}`;
  }
  await audit(
    {
      schoolId: input.schoolId, userId: input.userId, action: "paiement", table: "payments", recordId: payment.id,
      details: {
        receipt: receiptNumber, amount: credited.toString(), currency: check.feeCurrency,
        ...(converted ? { received: input.amountCents.toString(), received_currency: input.paidCurrency, rate: input.rate!.toString() } : {}),
        ...(input.batchId ? { batch: input.batchId } : {}),
        ...(check.duplicates.length ? { doublon_confirme: check.duplicates[0].receipt_number } : {}),
      },
    },
    tx,
  );
  for (const a of check.alerts) {
    await raiseAlert({ schoolId: input.schoolId, userId: input.userId, kind: a.kind, title: a.title, body: `Reçu ${receiptNumber}.`, link: `/recus/${payment.id}` }, tx);
  }
  return payment.id;
}

export async function recordPayment(input: PaymentInput): Promise<string> {
  return sql.begin((tx) => recordPaymentTx(tx, input));
}

/**
 * Paiement de plusieurs frais en une fois (souvent d'avance : le trimestre ou l'année).
 * Tout est enregistré ou rien ; chaque frais reçoit son reçu, regroupés par batch_id.
 */
export async function recordPaymentBatch(inputs: PaymentInput[]): Promise<string> {
  if (inputs.length === 0) throw new UserError("Choisissez au moins un frais.");
  const batchId = crypto.randomUUID();
  await sql.begin(async (tx) => {
    for (const input of inputs) await recordPaymentTx(tx, { ...input, batchId });
  });
  return batchId;
}

export type Receipt = {
  id: string;
  receipt_number: string;
  payment_date: Date;
  created_at: Date;
  amount_cents: bigint;
  currency: Currency;
  payment_method: PaymentMethod;
  transaction_number: string | null;
  comment: string | null;
  status: "valid" | "cancelled";
  cancel_reason: string | null;
  received_cents: bigint | null;
  received_currency: Currency | null;
  exchange_rate: string | null;
  fee_name: string;
  fee_due_date: Date | null;
  batch_id: string | null;
  fee_amount_cents: bigint;
  fee_remaining_cents: bigint;
  currency_remaining_cents: bigint;
  agent_name: string;
  student_id: string;
  student_number: string;
  scolar_code: string;
  last_name: string;
  middle_name: string | null;
  first_name: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_token: string;
  class_name: string | null;
  school_id: string;
  school_name: string;
  school_address: string | null;
  school_city: string | null;
  school_phone: string | null;
  school_email: string | null;
  receipt_footer: string | null;
  academic_year: string;
  has_logo: boolean;
};

/**
 * Données d'un reçu. Les soldes sont ceux du moment du paiement (paiements valides
 * enregistrés jusqu'à celui-ci), pour qu'une réimpression reste identique.
 */
export async function getReceipt(schoolId: string, paymentId: string): Promise<Receipt | null> {
  const [r] = await sql<Receipt[]>`
    select p.id, p.receipt_number, p.payment_date, p.created_at, p.amount_cents, p.currency, p.payment_method,
           p.transaction_number, p.comment, p.status, p.cancel_reason,
           p.received_cents, p.received_currency, p.exchange_rate,
           f.name as fee_name, f.due_date as fee_due_date, p.batch_id, coalesce(o.amount_cents, f.amount_cents) as fee_amount_cents,
           (coalesce(o.amount_cents, f.amount_cents) - (
              select coalesce(sum(p2.amount_cents), 0) from payments p2
              where p2.student_id = p.student_id and p2.fee_id = p.fee_id and p2.status = 'valid'
                and p2.created_at <= p.created_at))::bigint as fee_remaining_cents,
           0::bigint as currency_remaining_cents,
           u.name as agent_name,
           s.id as student_id, s.student_number, s.scolar_code, s.last_name, s.middle_name, s.first_name, s.parent_name, s.parent_phone, s.parent_token,
           c.name as class_name,
           sc.id as school_id, sc.name as school_name, sc.address as school_address, sc.city as school_city,
           sc.phone as school_phone, sc.email as school_email, sc.receipt_footer, sc.academic_year,
           sc.logo_data is not null as has_logo
    from payments p
    join fees f on f.id = p.fee_id
    left join student_fee_overrides o on o.fee_id = p.fee_id and o.student_id = p.student_id
    join users u on u.id = p.recorded_by
    join students s on s.id = p.student_id
    left join classes c on c.id = s.class_id
    join schools sc on sc.id = p.school_id
    where p.id = ${paymentId} and p.school_id = ${schoolId}`;
  if (!r) return null;

  // Solde total de l'élève dans la devise du paiement, au moment du paiement.
  const [{ remaining }] = await sql<{ remaining: bigint }[]>`
    with st as (select id, class_id from students where id = ${r.student_id}),
    paid as (
      select fee_id, sum(amount_cents)::bigint as paid from payments
      where student_id = ${r.student_id} and status = 'valid'
        and created_at <= (select created_at from payments where id = ${r.id})
      group by fee_id
    )
    select coalesce(sum(greatest(coalesce(o.amount_cents, f.amount_cents) - coalesce(paid.paid, 0), 0)), 0)::bigint as remaining
    from fees f cross join st
    left join paid on paid.fee_id = f.id
    left join student_fee_overrides o on o.fee_id = f.id and o.student_id = st.id
    where f.school_id = ${schoolId} and f.academic_year = ${r.academic_year} and f.currency = ${r.currency}
      and (paid.paid is not null or o.fee_id is not null
           or (not f.archived and not f.optional and (f.class_id is null or f.class_id = st.class_id)))`;
  r.currency_remaining_cents = remaining;
  return r;
}

/** « 142 500 FC au taux de 2 850 FC pour 1 $ », quand le parent a payé dans l'autre devise. */
export function receivedLabel(r: Pick<Receipt, "received_cents" | "received_currency" | "exchange_rate">): string | null {
  if (!r.received_cents || !r.received_currency || !r.exchange_rate) return null;
  return `${formatMoney(r.received_cents, r.received_currency)} au taux de ${formatRate(r.exchange_rate)}`;
}

/** « Payé d'avance (échéance du 01/03/2027) » quand le frais est réglé plus d'une semaine avant sa date limite. */
export function advanceLabel(r: Pick<Receipt, "fee_due_date" | "payment_date">): string | null {
  if (!r.fee_due_date) return null;
  const due = new Date(r.fee_due_date).getTime();
  const paid = new Date(r.payment_date).getTime();
  return due - paid > 7 * DAY ? `Payé d'avance (échéance du ${formatDate(r.fee_due_date)})` : null;
}
