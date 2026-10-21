import { sql } from "./db";
import { audit } from "./audit";
import { UserError } from "./actions";
import { formatMoney, type Currency } from "./money";
import type { PaymentMethod } from "./labels";

export async function recordPayment(input: {
  schoolId: string;
  userId: string;
  studentId: string;
  feeId: string;
  amountCents: bigint;
  method: PaymentMethod;
  transactionNumber: string | null;
  paymentDate: string;
  comment: string | null;
}): Promise<string> {
  return sql.begin(async (tx) => {
    // Un verrou par élève évite deux encaissements simultanés qui dépasseraient le montant dû.
    await tx`select pg_advisory_xact_lock(hashtext(${input.studentId}))`;

    const [student] = await tx<{ class_id: string | null; status: string }[]>`
      select class_id, status from students where id = ${input.studentId} and school_id = ${input.schoolId}`;
    if (!student) throw new UserError("Élève introuvable.");
    if (student.status !== "active") throw new UserError("Cet élève n'est plus actif : réactivez-le avant d'encaisser.");

    const [fee] = await tx<{ amount_cents: bigint; currency: Currency; class_id: string | null; archived: boolean;
                             optional: boolean; name: string; has_override: boolean }[]>`
      select coalesce(o.amount_cents, f.amount_cents) as amount_cents, f.currency, f.class_id, f.archived,
             f.optional, f.name, o.fee_id is not null as has_override
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

    const remaining = fee.amount_cents - paid;
    if (remaining <= BigInt(0)) {
      throw new UserError(fee.amount_cents === BigInt(0)
        ? `L'élève est exempté de « ${fee.name} » : rien à encaisser.`
        : `« ${fee.name} » est déjà entièrement payé pour cet élève.`);
    }
    if (input.amountCents > remaining) {
      throw new UserError(
        `Le montant dépasse le reste à payer pour « ${fee.name} » : ${formatMoney(remaining, fee.currency)} maximum.`,
      );
    }

    const [school] = await tx<{ receipt_counter: number; receipt_prefix: string }[]>`
      update schools set receipt_counter = receipt_counter + 1 where id = ${input.schoolId}
      returning receipt_counter, receipt_prefix`;
    const receiptNumber = `${school.receipt_prefix}-${input.paymentDate.slice(0, 4)}-${String(school.receipt_counter).padStart(6, "0")}`;

    const [payment] = await tx<{ id: string }[]>`
      insert into payments (school_id, student_id, fee_id, amount_cents, currency, payment_method,
                            transaction_number, receipt_number, payment_date, recorded_by, comment)
      values (${input.schoolId}, ${input.studentId}, ${input.feeId}, ${input.amountCents.toString()}, ${fee.currency},
              ${input.method}, ${input.transactionNumber}, ${receiptNumber}, ${input.paymentDate},
              ${input.userId}, ${input.comment})
      returning id`;
    await audit(
      {
        schoolId: input.schoolId, userId: input.userId, action: "paiement", table: "payments", recordId: payment.id,
        details: { receipt: receiptNumber, amount: input.amountCents.toString(), currency: fee.currency },
      },
      tx,
    );
    return payment.id;
  });
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
  fee_name: string;
  fee_amount_cents: bigint;
  fee_remaining_cents: bigint;
  currency_remaining_cents: bigint;
  agent_name: string;
  student_id: string;
  student_number: string;
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
           f.name as fee_name, coalesce(o.amount_cents, f.amount_cents) as fee_amount_cents,
           (coalesce(o.amount_cents, f.amount_cents) - (
              select coalesce(sum(p2.amount_cents), 0) from payments p2
              where p2.student_id = p.student_id and p2.fee_id = p.fee_id and p2.status = 'valid'
                and p2.created_at <= p.created_at))::bigint as fee_remaining_cents,
           0::bigint as currency_remaining_cents,
           u.name as agent_name,
           s.id as student_id, s.student_number, s.last_name, s.middle_name, s.first_name, s.parent_name, s.parent_phone, s.parent_token,
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
