import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { sql } from "./db";
import { todayISO } from "./labels";

export const SESSION_COOKIE = "ef_session";
const SESSION_DAYS = 7;

export type Role = "super_admin" | "director" | "cashier" | "teacher" | "parent";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  school_id: string | null;
};

export type CurrentSchool = {
  id: string;
  name: string;
  academic_year: string;
  status: "trial" | "active" | "suspended";
  subscription_plan: string;
  subscription_end_date: Date | null;
  has_logo: boolean;
  is_demo: boolean;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET doit contenir au moins 32 caractères");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Lit la session et recharge l'utilisateur en base (un compte désactivé est coupé immédiatement). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let uid: string;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    uid = String(payload.uid);
  } catch {
    return null;
  }
  const [user] = await sql<CurrentUser[]>`
    select id, name, email, role, school_id from users
    where id = ${uid} and status = 'active'`;
  return user ?? null;
});

export const getCurrentSchool = cache(async (schoolId: string): Promise<CurrentSchool | null> => {
  const [school] = await sql<CurrentSchool[]>`
    select id, name, academic_year, status, subscription_plan, subscription_end_date,
           logo_data is not null as has_logo, is_demo
    from schools where id = ${schoolId}`;
  return school ?? null;
});

export function isSubscriptionExpired(school: CurrentSchool): boolean {
  if (!school.subscription_end_date) return false;
  const end = new Date(school.subscription_end_date).toISOString().slice(0, 10);
  return end < todayISO();
}

export class AccessError extends Error {}

/**
 * Point d'entrée de chaque page et action d'une école : vérifie la connexion, le rôle,
 * et l'état du compte école. Toutes les requêtes utilisent ensuite ctx.school.id.
 */
export async function requireSchoolUser(roles: Role[] = ["director", "cashier"]) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.role === "super_admin") redirect("/admin");
  if (!user.school_id || !roles.includes(user.role)) redirect("/tableau-de-bord?refus=1");
  const school = await getCurrentSchool(user.school_id);
  if (!school) redirect("/connexion");
  if (school.status === "suspended") redirect("/suspendu");
  return { user, school, expired: isSubscriptionExpired(school) };
}

/** Variante pour les actions qui modifient des données : refusée si l'abonnement a expiré. */
export async function requireWriteAccess(roles: Role[] = ["director", "cashier"]) {
  const ctx = await requireSchoolUser(roles);
  if (ctx.expired) {
    throw new AccessError(
      "L'abonnement de l'école a expiré. Les données restent consultables ; contactez Scolar pour le renouveler.",
    );
  }
  return ctx;
}

/** Dans l'école de démonstration, ouverte à tous, on bloque ce qui empêcherait les visiteurs suivants d'entrer. */
export function assertNotDemo(school: CurrentSchool) {
  if (school.is_demo) {
    throw new AccessError("Désactivé dans l'école de démonstration. Créez l'espace de votre école pour l'utiliser.");
  }
}

export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.role !== "super_admin") redirect("/tableau-de-bord");
  return user;
}
