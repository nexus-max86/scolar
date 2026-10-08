"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { formAction, str, optStr, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { readLogo } from "@/lib/logo";

const TRIAL_DAYS = 30;
const attempts = new Map<string, { count: number; until: number }>();

function checkRateLimit(key: string) {
  const entry = attempts.get(key);
  if (entry && entry.until > Date.now() && entry.count >= 5) {
    throw new UserError("Trop de tentatives. Patientez 10 minutes avant de réessayer.");
  }
}

function recordFailure(key: string) {
  const entry = attempts.get(key);
  if (!entry || entry.until < Date.now()) attempts.set(key, { count: 1, until: Date.now() + 10 * 60_000 });
  else entry.count += 1;
}

export const login = formAction(async (_prev, formData) => {
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  if (!email || !password) return { error: "Saisissez votre e-mail et votre mot de passe." };
  checkRateLimit(email);

  const [user] = await sql<{ id: string; password_hash: string; status: string; role: string; school_id: string | null }[]>`
    select id, password_hash, status, role, school_id from users where lower(email) = ${email}`;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    recordFailure(email);
    return { error: "E-mail ou mot de passe incorrect." };
  }
  if (user.status !== "active") return { error: "Ce compte est désactivé. Contactez le directeur de l'école." };

  attempts.delete(email);
  await sql`update users set last_login_at = now() where id = ${user.id}`;
  await createSession(user.id);
  await audit({ schoolId: user.school_id, userId: user.id, action: "connexion", table: "users", recordId: user.id });
  redirect(user.role === "super_admin" ? "/admin" : "/tableau-de-bord");
});

export const registerSchool = formAction(async (_prev, formData) => {
  const school = {
    name: str(formData, "school_name"),
    address: optStr(formData, "address"),
    city: str(formData, "city"),
    phone: str(formData, "phone"),
    email: optStr(formData, "school_email"),
    academic_year: str(formData, "academic_year"),
  };
  const director = {
    name: str(formData, "director_name"),
    email: str(formData, "email").toLowerCase(),
    password: str(formData, "password"),
  };

  if (!school.name || !school.city || !school.phone || !school.academic_year) {
    return { error: "Renseignez le nom de l'école, la ville, le téléphone et l'année scolaire." };
  }
  if (!/^\d{4}-\d{4}$/.test(school.academic_year)) {
    return { error: "L'année scolaire doit avoir la forme 2026-2027." };
  }
  if (!director.name || !/^\S+@\S+\.\S+$/.test(director.email)) {
    return { error: "Renseignez le nom du directeur et une adresse e-mail valide." };
  }
  if (director.password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  if (director.password !== str(formData, "password_confirm")) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }
  const logo = await readLogo(formData);

  const [existing] = await sql`select 1 from users where lower(email) = ${director.email}`;
  if (existing) return { error: "Un compte existe déjà avec cet e-mail. Connectez-vous plutôt." };

  const passwordHash = await hashPassword(director.password);
  const userId = await sql.begin(async (tx) => {
    const [s] = await tx<{ id: string }[]>`
      insert into schools (name, address, city, phone, email, director_name, academic_year,
                           logo_data, logo_mime, status, subscription_plan, subscription_end_date)
      values (${school.name}, ${school.address}, ${school.city}, ${school.phone}, ${school.email},
              ${director.name}, ${school.academic_year}, ${logo?.data ?? null}, ${logo?.mime ?? null},
              'trial', 'basic', current_date + ${TRIAL_DAYS}::int)
      returning id`;
    const [u] = await tx<{ id: string }[]>`
      insert into users (school_id, name, email, password_hash, role)
      values (${s.id}, ${director.name}, ${director.email}, ${passwordHash}, 'director')
      returning id`;
    await audit({ schoolId: s.id, userId: u.id, action: "inscription_ecole", table: "schools", recordId: s.id }, tx);
    return u.id;
  });

  await createSession(userId);
  redirect("/tableau-de-bord?bienvenue=1");
});

export async function logout() {
  await destroySession();
  redirect("/connexion");
}
