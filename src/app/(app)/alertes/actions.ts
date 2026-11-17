"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireSchoolUser } from "@/lib/auth";
import { formAction, isUuid, str } from "@/lib/actions";

/** Marquer une alerte (ou toutes) comme vue. Pas besoin d'abonnement actif : on ne touche pas aux données de l'école. */
export const markAlertsRead = formAction(async (_prev, formData) => {
  const { user, school } = await requireSchoolUser(["director"]);
  const id = str(formData, "id");
  if (id && isUuid(id)) {
    await sql`update alerts set read_at = now(), read_by = ${user.id} where id = ${id} and school_id = ${school.id} and read_at is null`;
  } else {
    await sql`update alerts set read_at = now(), read_by = ${user.id} where school_id = ${school.id} and read_at is null`;
  }
  revalidatePath("/", "layout");
  return { success: id ? "Alerte marquée comme vue." : "Toutes les alertes sont marquées comme vues.", at: Date.now() };
});
