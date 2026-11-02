"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { hashPassword, requireSuperAdmin, verifyPassword } from "@/lib/auth";
import { formAction, str, isUuid, isISODate, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";

export const updateSubscription = formAction(async (_prev, formData) => {
  const admin = await requireSuperAdmin();
  const id = str(formData, "id");
  const status = str(formData, "status");
  const plan = str(formData, "plan");
  const end = str(formData, "end_date");
  if (!isUuid(id)) throw new UserError("École introuvable.");
  if (!["trial", "active", "suspended"].includes(status)) throw new UserError("Statut invalide.");
  if (!["basic", "standard", "premium"].includes(plan)) throw new UserError("Formule invalide.");
  if (end && !isISODate(end)) throw new UserError("Date de fin invalide.");
  const r = await sql`
    update schools set status = ${status}, subscription_plan = ${plan}, subscription_end_date = ${end || null}
    where id = ${id}`;
  if (r.count === 0) throw new UserError("École introuvable.");
  await audit({ schoolId: id, userId: admin.id, action: "modification_abonnement", table: "schools", recordId: id, details: { status, plan, end } });
  revalidatePath("/admin");
  return { success: "Abonnement mis à jour.", at: Date.now() };
});

export const changeAdminPassword = formAction(async (_prev, formData) => {
  const admin = await requireSuperAdmin();
  const current = str(formData, "current");
  const next = str(formData, "next");
  if (next.length < 10) throw new UserError("Le nouveau mot de passe doit contenir au moins 10 caractères.");
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${admin.id}`;
  if (!(await verifyPassword(current, row.password_hash))) throw new UserError("Le mot de passe actuel est incorrect.");
  await sql`update users set password_hash = ${await hashPassword(next)} where id = ${admin.id}`;
  await audit({ schoolId: null, userId: admin.id, action: "changement_mot_de_passe", table: "users", recordId: admin.id });
  return { success: "Votre mot de passe a été changé." };
});
