"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { assertNotDemo, hashPassword, requireWriteAccess } from "@/lib/auth";
import { formAction, str, optStr, isUuid, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";

export const createUser = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  assertNotDemo(school);
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const role = str(formData, "role");
  const password = str(formData, "password");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new UserError("Renseignez le nom et une adresse e-mail valide.");
  if (role !== "cashier" && role !== "director") throw new UserError("Choisissez un rôle.");
  if (password.length < 8) throw new UserError("Le mot de passe doit contenir au moins 8 caractères.");
  const [exists] = await sql`select 1 from users where lower(email) = ${email}`;
  if (exists) throw new UserError("Cette adresse e-mail est déjà utilisée par un autre compte.");
  const [u] = await sql<{ id: string }[]>`
    insert into users (school_id, name, email, phone, password_hash, role)
    values (${school.id}, ${name}, ${email}, ${optStr(formData, "phone")}, ${await hashPassword(password)}, ${role})
    returning id`;
  await audit({ schoolId: school.id, userId: user.id, action: "creation_utilisateur", table: "users", recordId: u.id, details: { role } });
  revalidatePath("/utilisateurs");
  return { success: `Compte créé pour ${name}. Communiquez-lui son e-mail et son mot de passe.`, at: Date.now() };
});

export const toggleUser = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  assertNotDemo(school);
  const id = str(formData, "id");
  if (!isUuid(id)) throw new UserError("Utilisateur introuvable.");
  if (id === user.id) throw new UserError("Vous ne pouvez pas désactiver votre propre compte.");
  const [u] = await sql<{ status: string }[]>`
    update users set status = case when status = 'active' then 'disabled' else 'active' end
    where id = ${id} and school_id = ${school.id} returning status`;
  if (!u) throw new UserError("Utilisateur introuvable.");
  await audit({ schoolId: school.id, userId: user.id, action: `utilisateur_${u.status}`, table: "users", recordId: id });
  revalidatePath("/utilisateurs");
  return { success: u.status === "active" ? "Compte réactivé." : "Compte désactivé : la personne ne peut plus se connecter." };
});

export const resetPassword = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  assertNotDemo(school);
  const id = str(formData, "id");
  const password = str(formData, "password");
  if (!isUuid(id)) throw new UserError("Utilisateur introuvable.");
  if (password.length < 8) throw new UserError("Le mot de passe doit contenir au moins 8 caractères.");
  const r = await sql`update users set password_hash = ${await hashPassword(password)} where id = ${id} and school_id = ${school.id}`;
  if (r.count === 0) throw new UserError("Utilisateur introuvable.");
  await audit({ schoolId: school.id, userId: user.id, action: "reinitialisation_mot_de_passe", table: "users", recordId: id });
  return { success: "Mot de passe modifié." };
});
