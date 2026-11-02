"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, str, optStr, isUuid, isISODate, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { formatMoney, parseAmount, parseRate, type Currency } from "@/lib/money";
import { PAYMENT_METHODS, todayISO, type PaymentMethod } from "@/lib/labels";
import { recordPayment } from "@/lib/payments";
import ExcelJS from "exceljs";
import { cellText, normalizeHeader, parseDate } from "@/lib/excel-read";
import { studentFeeLines } from "@/lib/finance";

export const createPayment = formAction(async (_prev, formData) => {
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

  const id = await recordPayment({
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
  });
  revalidatePath("/paiements");
  redirect(`/recus/${id}?nouveau=1`);
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

  const errors: string[] = [];
  const remainingByStudent = new Map<string, Map<string, { remaining: bigint; currency: Currency; name: string }>>();
  const ready: { studentId: string; feeId: string; amount: bigint; date: string; method: PaymentMethod; paper: string }[] = [];
  const today = todayISO();
  for (const r of rows) {
    const at = `Ligne ${r.line}`;
    const studentId = students.get(r.number.trim().toLowerCase());
    if (!studentId) { errors.push(`${at} : matricule « ${r.number} » inconnu`); continue; }
    const feeId = fees.get(r.fee.replace(/\s+/g, " ").trim().toLowerCase());
    if (!feeId) { errors.push(`${at} : frais « ${r.fee} » inconnu (voir l'onglet Frais)`); continue; }
    const amount = parseAmount(r.amount);
    if (!amount || amount <= BigInt(0)) { errors.push(`${at} : montant « ${r.amount} » invalide`); continue; }
    const date = parseDate(r.date);
    if (!date || !isISODate(date)) { errors.push(`${at} : date « ${r.date} » invalide (ex. 15/09/2026)`); continue; }
    if (date > today) { errors.push(`${at} : date dans le futur`); continue; }
    const method = r.method ? methods.get(normalizeHeader(r.method)) : "especes";
    if (!method) { errors.push(`${at} : moyen « ${r.method} » inconnu`); continue; }

    let lines = remainingByStudent.get(studentId);
    if (!lines) {
      lines = new Map(
        (await studentFeeLines(school.id, studentId, school.academic_year))
          .map((l) => [l.fee_id, { remaining: l.remaining_cents, currency: l.currency, name: l.name }]),
      );
      remainingByStudent.set(studentId, lines);
    }
    const line = lines.get(feeId);
    if (!line) { errors.push(`${at} : « ${r.fee} » ne concerne pas cet élève (autre classe ou frais optionnel)`); continue; }
    if (amount > line.remaining) {
      errors.push(`${at} : ${formatMoney(amount, line.currency)} dépasse le reste à payer (${formatMoney(line.remaining > BigInt(0) ? line.remaining : BigInt(0), line.currency)})`);
      continue;
    }
    line.remaining -= amount;
    ready.push({ studentId, feeId, amount, date, method, paper: r.paper });
  }
  if (errors.length) {
    return {
      error: `Rien n'a été importé. Corrigez ${errors.length > 1 ? `ces ${errors.length} lignes` : "cette ligne"} puis renvoyez le fichier : ` +
        errors.slice(0, 15).join(" ; ") + (errors.length > 15 ? "…" : ""),
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
