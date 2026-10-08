"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
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
