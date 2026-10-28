"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { demoEnabled, demoSchoolId, demoShowcase } from "@/lib/demo";

/** Entrée dans l'école de démonstration, sans mot de passe, avec le rôle choisi. */
export async function enterDemo(formData: FormData) {
  const role = String(formData.get("role"));
  const schoolId = demoEnabled() ? await demoSchoolId() : null;
  if (!schoolId) redirect("/demo?indisponible=1");

  if (role === "parent") {
    const show = await demoShowcase(schoolId);
    redirect(show ? `/p/${show.parent_token}` : "/demo?indisponible=1");
  }
  const [user] = await sql<{ id: string }[]>`
    select id from users where school_id = ${schoolId} and status = 'active'
      and role = ${role === "cashier" ? "cashier" : "director"}
    order by created_at limit 1`;
  if (!user) redirect("/demo?indisponible=1");
  await createSession(user.id);
  redirect(role === "cashier" ? "/paiements/nouveau" : "/tableau-de-bord");
}

/** Quitte la démo : on se déconnecte pour pouvoir créer le vrai espace de l'école. */
export async function leaveDemo(formData: FormData) {
  await destroySession();
  redirect(formData.get("to") === "inscription" ? "/inscription" : "/");
}
