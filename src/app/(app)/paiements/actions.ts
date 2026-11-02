"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, str, optStr, isUuid, isISODate, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { parseAmount, parseRate, type Currency } from "@/lib/money";
import { PAYMENT_METHODS, todayISO, type PaymentMethod } from "@/lib/labels";
import { recordPayment } from "@/lib/payments";

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
