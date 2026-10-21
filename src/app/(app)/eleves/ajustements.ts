"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, str, optStr, isUuid, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { formatMoney, parseAmount, type Currency } from "@/lib/money";

async function loadFee(schoolId: string, studentId: string, feeId: string) {
  const [row] = await sql<{ amount_cents: bigint; currency: Currency; name: string; paid: bigint }[]>`
    select f.amount_cents, f.currency, f.name,
           (select coalesce(sum(amount_cents), 0) from payments p
             where p.student_id = ${studentId} and p.fee_id = f.id and p.status = 'valid')::bigint as paid
    from fees f join students s on s.id = ${studentId} and s.school_id = ${schoolId}
    where f.id = ${feeId} and f.school_id = ${schoolId}`;
  if (!row) throw new UserError("Élève ou frais introuvable.");
  return row;
}

/** Réduction, montant spécial ou exemption d'un élève pour un frais (directeur uniquement). */
export const adjustFee = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const studentId = str(formData, "student_id");
  const feeId = str(formData, "fee_id");
  const mode = str(formData, "mode");
  if (!isUuid(studentId) || !isUuid(feeId)) throw new UserError("Élève ou frais introuvable.");
  const fee = await loadFee(school.id, studentId, feeId);

  let amount: bigint;
  if (mode === "exempt") amount = BigInt(0);
  else if (mode === "percent") {
    const pct = Number(str(formData, "value").replace(",", "."));
    if (!(pct > 0 && pct <= 100)) throw new UserError("Le pourcentage de réduction doit être entre 1 et 100.");
    amount = (fee.amount_cents * BigInt(Math.round((100 - pct) * 100))) / BigInt(10000);
  } else if (mode === "amount") {
    const v = parseAmount(str(formData, "value"));
    if (v === null) throw new UserError("Saisissez le montant que l'élève doit payer, par exemple 40.");
    amount = v;
  } else throw new UserError("Choisissez le type d'ajustement.");

  if (amount < fee.paid) {
    throw new UserError(`L'élève a déjà payé ${formatMoney(fee.paid, fee.currency)} pour ce frais : le montant ne peut pas être inférieur.`);
  }
  const reason = optStr(formData, "reason");
  await sql`
    insert into student_fee_overrides (student_id, fee_id, school_id, amount_cents, reason, created_by)
    values (${studentId}, ${feeId}, ${school.id}, ${amount.toString()}, ${reason}, ${user.id})
    on conflict (student_id, fee_id) do update
      set amount_cents = excluded.amount_cents, reason = excluded.reason, created_by = excluded.created_by, created_at = now()`;
  await audit({
    schoolId: school.id, userId: user.id, action: "ajustement_frais", table: "students", recordId: studentId,
    details: { fee: feeId, amount: amount.toString(), reason },
  });
  revalidatePath(`/eleves/${studentId}`);
  return {
    success: amount === BigInt(0)
      ? `Élève exempté de « ${fee.name} ».`
      : `« ${fee.name} » : l'élève doit maintenant ${formatMoney(amount, fee.currency)}.`,
    at: Date.now(),
  };
});

/** Retire l'ajustement : l'élève revient au montant normal (ou est désinscrit d'un frais optionnel). */
export const removeAdjustment = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const studentId = str(formData, "student_id");
  const feeId = str(formData, "fee_id");
  if (!isUuid(studentId) || !isUuid(feeId)) throw new UserError("Élève ou frais introuvable.");
  const [fee] = await sql<{ optional: boolean; paid: bigint }[]>`
    select f.optional,
           (select coalesce(sum(amount_cents), 0) from payments p
             where p.student_id = ${studentId} and p.fee_id = f.id and p.status = 'valid')::bigint as paid
    from fees f where f.id = ${feeId} and f.school_id = ${school.id}`;
  if (!fee) throw new UserError("Frais introuvable.");
  if (fee.optional && fee.paid > BigInt(0)) {
    throw new UserError("Des paiements existent déjà pour ce frais : l'élève ne peut pas en être désinscrit.");
  }
  await sql`delete from student_fee_overrides where student_id = ${studentId} and fee_id = ${feeId} and school_id = ${school.id}`;
  await audit({ schoolId: school.id, userId: user.id, action: "suppression_ajustement", table: "students", recordId: studentId, details: { fee: feeId } });
  revalidatePath(`/eleves/${studentId}`);
  return { success: fee.optional ? "Élève désinscrit de ce frais." : "Montant normal rétabli." };
});

/** Inscrit l'élève à un ou plusieurs frais optionnels (ex. les 10 mensualités du transport). */
export const enrollOptional = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director", "cashier"]);
  const studentId = str(formData, "student_id");
  const feeIds = formData.getAll("fee_id").map(String).filter(isUuid);
  if (!isUuid(studentId) || feeIds.length === 0) throw new UserError("Choisissez au moins un frais.");
  const [student] = await sql`select 1 from students where id = ${studentId} and school_id = ${school.id}`;
  if (!student) throw new UserError("Élève introuvable.");
  const inserted = await sql`
    insert into student_fee_overrides (student_id, fee_id, school_id, amount_cents, reason, created_by)
    select ${studentId}, f.id, ${school.id}, f.amount_cents, 'Inscrit au frais optionnel', ${user.id}
    from fees f where f.id in ${sql(feeIds)} and f.school_id = ${school.id} and f.optional
    on conflict do nothing`;
  await audit({ schoolId: school.id, userId: user.id, action: "inscription_frais_optionnel", table: "students", recordId: studentId, details: { fees: feeIds } });
  revalidatePath(`/eleves/${studentId}`);
  return { success: `Élève inscrit (${inserted.count} échéance${inserted.count > 1 ? "s" : ""}).`, at: Date.now() };
});

/** Nouveau lien parent : l'ancien lien cesse de fonctionner (ex. lien partagé par erreur). */
export const resetParentLink = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const studentId = str(formData, "student_id");
  if (!isUuid(studentId)) throw new UserError("Élève introuvable.");
  const r = await sql`
    update students set parent_token = replace(gen_random_uuid()::text, '-', '')
    where id = ${studentId} and school_id = ${school.id}`;
  if (r.count === 0) throw new UserError("Élève introuvable.");
  await audit({ schoolId: school.id, userId: user.id, action: "nouveau_lien_parent", table: "students", recordId: studentId });
  revalidatePath(`/eleves/${studentId}`);
  return { success: "Nouveau lien créé. L'ancien ne fonctionne plus : envoyez le nouveau au parent." };
});
