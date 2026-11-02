"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { assertNotDemo, getCurrentUser, hashPassword, requireSchoolUser, requireWriteAccess, verifyPassword } from "@/lib/auth";
import { formAction, str, optStr, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { readLogo } from "@/lib/logo";

export const updateSchool = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  assertNotDemo(school);
  const name = str(formData, "name");
  const year = str(formData, "academic_year");
  const prefix = str(formData, "receipt_prefix").toUpperCase();
  if (!name) throw new UserError("Le nom de l'école est obligatoire.");
  if (!/^\d{4}-\d{4}$/.test(year)) throw new UserError("L'année scolaire doit avoir la forme 2026-2027.");
  if (!/^[A-Z0-9]{1,8}$/.test(prefix)) throw new UserError("Le préfixe des reçus : 1 à 8 lettres ou chiffres, sans espace.");
  const format = str(formData, "receipt_format") || "a4";
  if (!["a4", "ticket58", "ticket80"].includes(format)) throw new UserError("Format de reçu inconnu.");
  const logo = await readLogo(formData);
  const removeLogo = formData.get("remove_logo") === "on";

  await sql`
    update schools set name = ${name}, address = ${optStr(formData, "address")}, city = ${optStr(formData, "city")},
      phone = ${optStr(formData, "phone")}, email = ${optStr(formData, "email")},
      director_name = ${optStr(formData, "director_name")}, academic_year = ${year},
      receipt_prefix = ${prefix}, receipt_footer = ${optStr(formData, "receipt_footer")},
      receipt_format = ${format}
      ${logo ? sql`, logo_data = ${logo.data}, logo_mime = ${logo.mime}` : removeLogo ? sql`, logo_data = null, logo_mime = null` : sql``}
    where id = ${school.id}`;
  await audit({ schoolId: school.id, userId: user.id, action: "modification_ecole", table: "schools", recordId: school.id });
  revalidatePath("/", "layout");
  return {
    success: year !== school.academic_year
      ? `Paramètres enregistrés. L'école travaille maintenant sur l'année ${year} : créez les classes et les frais de cette année.`
      : "Paramètres enregistrés.",
    at: Date.now(),
  };
});

export const changeOwnPassword = formAction(async (_prev, formData) => {
  const { school } = await requireSchoolUser();
  assertNotDemo(school);
  const user = await getCurrentUser();
  if (!user) throw new UserError("Session expirée.");
  const current = str(formData, "current");
  const next = str(formData, "next");
  if (next.length < 8) throw new UserError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${user.id}`;
  if (!(await verifyPassword(current, row.password_hash))) throw new UserError("Le mot de passe actuel est incorrect.");
  await sql`update users set password_hash = ${await hashPassword(next)} where id = ${user.id}`;
  await audit({ schoolId: user.school_id, userId: user.id, action: "changement_mot_de_passe", table: "users", recordId: user.id });
  return { success: "Votre mot de passe a été changé." };
});
