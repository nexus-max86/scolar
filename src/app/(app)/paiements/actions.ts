"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, str, optStr, isUuid, isISODate, UserError, type ReportRow } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { convertCents, emptyTotals, formatMoney, formatRate, formatTotals, parseAmount, parseRate, type Currency } from "@/lib/money";
import { PAYMENT_METHODS, formatDate, studentFullName, todayISO, type PaymentMethod } from "@/lib/labels";
import { checkPayment, DuplicatePaymentError, recordPayment, recordPaymentBatch, type PaymentInput } from "@/lib/payments";
import type { PaymentPreview } from "@/lib/payment-preview";
import { raiseAlert } from "@/lib/alerts";
import ExcelJS from "exceljs";
import { cellText, normalizeHeader, parseDate } from "@/lib/excel-read";
import { studentFeeLines } from "@/lib/finance";

/** Lecture et contrôle du formulaire d'encaissement (un frais). */
async function readPaymentForm(formData: FormData) {
  const { user, school } = await requireWriteAccess();
  const studentId = str(formData, "student_id");
  const feeId = str(formData, "fee_id");
  const amount = parseAmount(str(formData, "amount"));
  const method = str(formData, "payment_method");
  const date = str(formData, "payment_date") || todayISO();

  if (!isUuid(studentId)) throw new UserError("Choisissez un élève.");
  if (!isUuid(feeId)) throw new UserError("Choisissez le frais payé.");
  if (!amount || amount <= BigInt(0)) throw new UserError("Saisissez un montant valide, par exemple 50 ou 25000.");
  if (!(method in PAYMENT_METHODS)) throw new UserError("Choisissez le moyen de paiement.");
  if (!isISODate(date)) throw new UserError("La date du paiement n'est pas valide.");
  if (date > todayISO()) throw new UserError("La date du paiement ne peut pas être dans le futur.");
  const paidCurrency = str(formData, "paid_currency");
  const rateText = str(formData, "exchange_rate");
  const rate = rateText ? parseRate(rateText) : null;
  if (rateText && !rate) throw new UserError("Le taux du jour n'est pas valide, par exemple 2850.");

  const input: PaymentInput = {
    schoolId: school.id,
    userId: user.id,
    studentId,
    feeId,
    amountCents: amount,
    method: method as PaymentMethod,
    transactionNumber: optStr(formData, "transaction_number"),
    paymentDate: date,
    comment: optStr(formData, "comment"),
    paidCurrency: paidCurrency === "USD" || paidCurrency === "CDF" ? (paidCurrency as Currency) : undefined,
    rate,
    confirmDuplicate: formData.get("confirm_duplicate") === "1",
  };
  return { input, school };
}

async function studentSummary(schoolId: string, studentId: string) {
  const [s] = await sql<{ last_name: string; middle_name: string | null; first_name: string | null; class_name: string | null; student_number: string }[]>`
    select s.last_name, s.middle_name, s.first_name, s.student_number, c.name as class_name
    from students s left join classes c on c.id = s.class_id where s.id = ${studentId} and s.school_id = ${schoolId}`;
  if (!s) throw new UserError("Élève introuvable.");
  return { name: studentFullName(s), detail: `${s.class_name ?? "Sans classe"} · Matricule ${s.student_number}` };
}

/** Écran de confirmation : ce qui va être enregistré, avec les mises en garde. Rien n'est enregistré ici. */
export const previewPayment = formAction(async (_prev, formData) => {
  const { input, school } = await readPaymentForm(formData);
  const check = await checkPayment(sql, input);
  const student = await studentSummary(school.id, input.studentId);
  const paidIn = input.paidCurrency ?? check.feeCurrency;
  const preview: PaymentPreview = {
    student: student.name,
    studentDetail: student.detail,
    total: formatMoney(input.amountCents, paidIn),
    lines: [{
      fee: check.feeName,
      amount: formatMoney(check.credited, check.feeCurrency),
      after: check.remainingAfter > BigInt(0) ? `reste ${formatMoney(check.remainingAfter, check.feeCurrency)}` : "soldé",
      advance: check.advance,
    }],
    rows: [
      ["Moyen", PAYMENT_METHODS[input.method]],
      ["Date", formatDate(input.paymentDate)],
      ...(check.converted ? [["Taux du jour", formatRate(input.rate!)] as [string, string], ["Crédité sur le frais", formatMoney(check.credited, check.feeCurrency)] as [string, string]] : []),
      ...(input.transactionNumber ? [["N° de transaction", input.transactionNumber] as [string, string]] : []),
    ],
    warnings: check.warnings,
    duplicate: check.duplicates.length > 0,
  };
  return { data: preview, at: Date.now() };
});

export const createPayment = formAction(async (_prev, formData) => {
  const { input } = await readPaymentForm(formData);
  if (formData.get("confirmed") !== "1") throw new UserError("Vérifiez le paiement puis confirmez-le.");
  let id: string;
  try {
    id = await recordPayment(input);
  } catch (err) {
    if (err instanceof DuplicatePaymentError) return { error: err.message, data: { needsDuplicateConfirm: true }, at: Date.now() };
    throw err;
  }
  revalidatePath("/paiements");
  redirect(`/recus/${id}?nouveau=1`);
});

/** Lecture du formulaire « payer plusieurs frais » : chaque frais coché est payé en entier. */
async function readBatchForm(formData: FormData) {
  const { user, school } = await requireWriteAccess();
  const studentId = str(formData, "student_id");
  const feeIds = formData.getAll("fee_ids").map(String).filter(isUuid);
  const method = str(formData, "payment_method");
  const date = str(formData, "payment_date") || todayISO();
  if (!isUuid(studentId)) throw new UserError("Choisissez un élève.");
  if (feeIds.length === 0) throw new UserError("Cochez au moins un frais à payer.");
  if (!(method in PAYMENT_METHODS)) throw new UserError("Choisissez le moyen de paiement.");
  if (!isISODate(date) || date > todayISO()) throw new UserError("La date du paiement n'est pas valide.");
  const paidCurrency = str(formData, "paid_currency");
  const rateText = str(formData, "exchange_rate");
  const rate = rateText ? parseRate(rateText) : null;
  if (rateText && !rate) throw new UserError("Le taux du jour n'est pas valide, par exemple 2850.");

  const lines = new Map((await studentFeeLines(school.id, studentId, school.academic_year)).map((l) => [l.fee_id, l]));
  const inputs: PaymentInput[] = [];
  for (const feeId of feeIds) {
    const l = lines.get(feeId);
    if (!l || l.remaining_cents <= BigInt(0)) throw new UserError("Un des frais cochés est déjà payé. Rechargez la page.");
    const pc = paidCurrency === "USD" || paidCurrency === "CDF" ? (paidCurrency as Currency) : l.currency;
    if (pc !== l.currency && !rate) throw new UserError("Indiquez le taux du jour (francs pour 1 dollar).");
    inputs.push({
      schoolId: school.id, userId: user.id, studentId, feeId,
      amountCents: pc === l.currency ? l.remaining_cents : convertCents(l.remaining_cents, l.currency, pc, rate!),
      method: method as PaymentMethod,
      transactionNumber: null,
      paymentDate: date,
      comment: optStr(formData, "comment"),
      paidCurrency: pc,
      rate,
      confirmDuplicate: formData.get("confirm_duplicate") === "1",
    });
  }
  return { inputs, school, transactionNumber: optStr(formData, "transaction_number") };
}

export const previewBatchPayment = formAction(async (_prev, formData) => {
  const { inputs, school, transactionNumber } = await readBatchForm(formData);
  const student = await studentSummary(school.id, inputs[0].studentId);
  const total = emptyTotals();
  const lines: PaymentPreview["lines"] = [];
  const warnings: PaymentPreview["warnings"] = [];
  let duplicate = false;
  for (const input of inputs) {
    const check = await checkPayment(sql, { ...input, transactionNumber });
    total[input.paidCurrency!] += input.amountCents;
    lines.push({ fee: check.feeName, amount: formatMoney(check.credited, check.feeCurrency), after: "soldé", advance: check.advance });
    for (const w of check.warnings) if (w.level !== "info") warnings.push({ ...w, text: `${check.feeName} : ${w.text}` });
    duplicate ||= check.duplicates.length > 0;
  }
  const advanceCount = lines.filter((l) => l.advance).length;
  if (advanceCount) warnings.push({ level: "info", text: `${advanceCount} frais payé${advanceCount > 1 ? "s" : ""} d'avance (date limite pas encore arrivée).` });
  const first = inputs[0];
  const preview: PaymentPreview = {
    student: student.name,
    studentDetail: student.detail,
    total: formatTotals(total),
    lines,
    rows: [
      ["Moyen", PAYMENT_METHODS[first.method]],
      ["Date", formatDate(first.paymentDate)],
      ...(first.rate && inputs.some((i) => i.paidCurrency !== undefined) ? [["Taux du jour", formatRate(first.rate)] as [string, string]] : []),
      ["Reçus", `${inputs.length} reçu${inputs.length > 1 ? "s" : ""}, un par frais`],
    ],
    warnings,
    duplicate,
  };
  return { data: preview, at: Date.now() };
});

export const createBatchPayment = formAction(async (_prev, formData) => {
  const { inputs, transactionNumber } = await readBatchForm(formData);
  if (formData.get("confirmed") !== "1") throw new UserError("Vérifiez le paiement puis confirmez-le.");
  // Le n° de transaction (un seul transfert pour tous les frais) n'est noté que sur le premier reçu.
  inputs[0].transactionNumber = transactionNumber;
  for (const i of inputs.slice(1)) i.comment = [i.comment, transactionNumber && `Transaction ${transactionNumber}`].filter(Boolean).join(" · ") || null;
  let batchId: string;
  try {
    batchId = await recordPaymentBatch(inputs);
  } catch (err) {
    if (err instanceof DuplicatePaymentError) return { error: err.message, data: { needsDuplicateConfirm: true }, at: Date.now() };
    throw err;
  }
  revalidatePath("/paiements");
  redirect(`/recus/lot/${batchId}?nouveau=1`);
});

/** Un paiement ne se supprime jamais : le directeur l'annule avec un motif, le reçu reste traçable. */
export const cancelPayment = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const id = str(formData, "id");
  const reason = str(formData, "reason");
  if (!isUuid(id)) throw new UserError("Paiement introuvable.");
  if (reason.length < 3) throw new UserError("Indiquez le motif de l'annulation.");
  const r = await sql`
    update payments set status = 'cancelled', cancelled_by = ${user.id}, cancelled_at = now(), cancel_reason = ${reason}
    where id = ${id} and school_id = ${school.id} and status = 'valid'`;
  if (r.count === 0) throw new UserError("Ce paiement est introuvable ou déjà annulé.");
  await audit({ schoolId: school.id, userId: user.id, action: "annulation_paiement", table: "payments", recordId: id, details: { reason } });
  revalidatePath(`/recus/${id}`);
  return { success: "Paiement annulé. Le solde de l'élève a été recalculé." };
});

const PAYMENT_IMPORT_COLUMNS: Record<string, string> = {
  matricule: "number",
  frais: "fee",
  montant: "amount",
  date: "date",
  moyen: "method",
  "n° recu papier": "paper",
  "no recu papier": "paper",
  // Intitulés fréquents dans les fichiers des écoles.
  "n° matricule": "number",
  "numero matricule": "number",
  "type de frais": "fee",
  "libelle": "fee",
  "montant paye": "amount",
  "somme": "amount",
  "date de paiement": "date",
  "date paiement": "date",
  "moyen de paiement": "method",
  "mode de paiement": "method",
  "n° recu": "paper",
  "numero recu": "paper",
  "recu": "paper",
};

/**
 * Reprise des paiements reçus avant Scolar (fichier Excel de l'école). Tout le fichier est vérifié d'abord :
 * s'il y a une seule erreur, rien n'est importé et l'école corrige son fichier.
 */
export const importPayments = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Choisissez un fichier Excel (.xlsx).");
  if (file.size > 5 * 1024 * 1024) throw new UserError("Fichier trop lourd (5 Mo maximum).");

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
  } catch {
    throw new UserError("Ce fichier n'est pas un fichier Excel .xlsx lisible. Utilisez le modèle proposé.");
  }
  const sheet = workbook.getWorksheet("Paiements") ?? workbook.worksheets[0];
  if (!sheet) throw new UserError("Le fichier est vide.");
  const headerMap = new Map<number, string>();
  sheet.getRow(1).eachCell((cell, col) => {
    const key = PAYMENT_IMPORT_COLUMNS[normalizeHeader(cellText(cell.value))];
    if (key) headerMap.set(col, key);
  });
  for (const [key, label] of [["number", "Matricule"], ["fee", "Frais"], ["amount", "Montant"], ["date", "Date"]]) {
    if (![...headerMap.values()].includes(key)) {
      throw new UserError(`Colonne « ${label} » introuvable sur la première ligne. Utilisez le modèle proposé.`);
    }
  }

  type Row = { line: number; number: string; fee: string; amount: string; date: string; method: string; paper: string };
  const rows: Row[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const r: Row = { line: n, number: "", fee: "", amount: "", date: "", method: "", paper: "" };
    headerMap.forEach((key, col) => (r[key as keyof Omit<Row, "line">] = cellText(row.getCell(col).value)));
    // Les lignes du modèle sans frais ni montant sont des élèves qui n'ont rien payé : on les ignore.
    if (r.fee || r.amount) rows.push(r);
  });
  if (rows.length === 0) throw new UserError("Aucun paiement trouvé : remplissez au moins les colonnes Frais et Montant.");
  if (rows.length > 3000) throw new UserError("3 000 paiements maximum par import.");

  const students = new Map(
    (await sql<{ id: string; student_number: string }[]>`
      select id, student_number from students where school_id = ${school.id} and status = 'active'`)
      .map((s) => [s.student_number.trim().toLowerCase(), s.id]),
  );
  const fees = new Map(
    (await sql<{ id: string; name: string }[]>`
      select id, name from fees where school_id = ${school.id} and academic_year = ${school.academic_year} and not archived`)
      .map((f) => [f.name.replace(/\s+/g, " ").trim().toLowerCase(), f.id]),
  );
  const methods = new Map<string, PaymentMethod>();
  for (const [k, v] of Object.entries(PAYMENT_METHODS)) {
    methods.set(normalizeHeader(k), k as PaymentMethod);
    methods.set(normalizeHeader(v), k as PaymentMethod);
  }

  const errors: ReportRow[] = [];
  const remainingByStudent = new Map<string, Map<string, { remaining: bigint; currency: Currency; name: string }>>();
  const ready: { studentId: string; feeId: string; amount: bigint; date: string; method: PaymentMethod; paper: string }[] = [];
  const seenInFile = new Map<string, number>();
  const seenPaper = new Map<string, number>();
  // Reçus papier déjà repris lors d'un import précédent (le commentaire garde leur numéro).
  const paperDone = new Set(
    (await sql<{ comment: string }[]>`
      select comment from payments where school_id = ${school.id} and imported and status = 'valid' and comment like 'Reprise : reçu papier n° %'`)
      .map((p) => p.comment.replace("Reprise : reçu papier n° ", "").trim().toLowerCase()),
  );
  const today = todayISO();
  for (const r of rows) {
    const at = `Ligne ${r.line}`;
    const err = (problem: string, fix?: string) => errors.push({ where: at, problem, fix });
    const studentId = students.get(r.number.trim().toLowerCase());
    if (!studentId) { err(`Matricule « ${r.number || "vide"} » inconnu`, "Copiez le matricule depuis l'onglet Élèves du modèle."); continue; }
    const feeId = fees.get(r.fee.replace(/\s+/g, " ").trim().toLowerCase());
    if (!feeId) { err(`Frais « ${r.fee || "vide"} » inconnu`, "Choisissez le frais dans la liste (onglet Frais du modèle)."); continue; }
    const amount = parseAmount(r.amount);
    if (!amount || amount <= BigInt(0)) { err(`Montant « ${r.amount || "vide"} » invalide`, "Écrivez seulement le nombre, sans $ ni FC : 50 ou 25000."); continue; }
    const date = parseDate(r.date);
    if (!date || !isISODate(date)) { err(`Date « ${r.date || "vide"} » invalide`, "Écrivez la date comme 15/09/2026."); continue; }
    if (date > today) { err("Date dans le futur", "Vérifiez le jour, le mois et l'année."); continue; }
    const method = r.method ? methods.get(normalizeHeader(r.method)) : "especes";
    if (!method) { err(`Moyen « ${r.method} » inconnu`, "Espèces, M-Pesa, Airtel Money, Orange Money, Virement ou laissez vide."); continue; }

    const paperKey = r.paper.trim().toLowerCase();
    if (paperKey) {
      const before = seenPaper.get(paperKey);
      if (before) { err(`Reçu papier n° ${r.paper} en double (déjà ligne ${before})`, "Supprimez la ligne en trop ou corrigez le numéro."); continue; }
      if (paperDone.has(paperKey)) { err(`Reçu papier n° ${r.paper} déjà repris lors d'un import précédent`, "Supprimez cette ligne : ce paiement est déjà dans Scolar."); continue; }
      seenPaper.set(paperKey, r.line);
    }
    const dupKey = `${studentId}|${feeId}|${amount}|${date}`;
    const dupLine = seenInFile.get(dupKey);
    if (dupLine && !paperKey) { err(`Même paiement que la ligne ${dupLine} (même élève, frais, montant et date)`, "Si le parent a vraiment payé deux fois, indiquez les n° de reçus papier pour les distinguer."); continue; }
    seenInFile.set(dupKey, r.line);
    const [already] = await sql<{ receipt_number: string }[]>`
      select receipt_number from payments
      where student_id = ${studentId} and fee_id = ${feeId} and amount_cents = ${amount.toString()}
        and payment_date = ${date} and status = 'valid' limit 1`;
    if (already && !paperKey) { err(`Paiement déjà enregistré dans Scolar (reçu ${already.receipt_number})`, "Supprimez cette ligne : le fichier a peut-être déjà été importé."); continue; }

    let lines = remainingByStudent.get(studentId);
    if (!lines) {
      lines = new Map(
        (await studentFeeLines(school.id, studentId, school.academic_year))
          .map((l) => [l.fee_id, { remaining: l.remaining_cents, currency: l.currency, name: l.name }]),
      );
      remainingByStudent.set(studentId, lines);
    }
    const line = lines.get(feeId);
    if (!line) { err(`« ${r.fee} » ne concerne pas cet élève`, "Autre classe ou frais optionnel : inscrivez l'élève au frais depuis sa fiche."); continue; }
    if (amount > line.remaining) {
      err(`${formatMoney(amount, line.currency)} dépasse le reste à payer (${formatMoney(line.remaining > BigInt(0) ? line.remaining : BigInt(0), line.currency)})`,
        "Vérifiez le montant, ou s'il n'y a pas deux lignes pour le même paiement.");
      continue;
    }
    line.remaining -= amount;
    ready.push({ studentId, feeId, amount, date, method, paper: r.paper });
  }
  if (errors.length) {
    await raiseAlert({
      schoolId: school.id, userId: user.id, kind: "import",
      title: `Reprise des paiements refusée : ${errors.length} ligne${errors.length > 1 ? "s" : ""} à corriger`,
      body: errors.slice(0, 20).map((e) => `${e.where} : ${e.problem}`).join("\n"),
      link: "/paiements/import",
    });
    return {
      error: `Rien n'a été importé. Corrigez ${errors.length > 1 ? `ces ${errors.length} lignes` : "cette ligne"} dans votre fichier, enregistrez-le, puis renvoyez-le.`,
      report: errors,
      reportTitle: "Lignes à corriger dans le fichier",
      at: Date.now(),
    };
  }

  for (const p of ready) {
    await recordPayment({
      schoolId: school.id,
      userId: user.id,
      studentId: p.studentId,
      feeId: p.feeId,
      amountCents: p.amount,
      method: p.method,
      transactionNumber: null,
      paymentDate: p.date,
      comment: p.paper ? `Reprise : reçu papier n° ${p.paper}` : "Reprise des paiements avant Scolar",
      imported: true,
    });
  }
  await audit({ schoolId: school.id, userId: user.id, action: "import_paiements", table: "payments", details: { count: ready.length } });
  revalidatePath("/", "layout");
  return { success: `${ready.length} paiement${ready.length > 1 ? "s" : ""} repris. Les soldes des élèves sont à jour.`, at: Date.now() };
});
