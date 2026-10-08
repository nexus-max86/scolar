import { getCurrentSchool, getCurrentUser, type Role } from "./auth";

/** Vérification d'accès pour les routes API (exports, PDF) : retourne null si refusé. */
export async function routeSchoolUser(roles: Role[] = ["director", "cashier"]) {
  const user = await getCurrentUser();
  if (!user?.school_id || !roles.includes(user.role)) return null;
  const school = await getCurrentSchool(user.school_id);
  if (!school || school.status === "suspended") return null;
  return { user, school };
}

export const forbidden = () => new Response("Accès refusé. Connectez-vous à nouveau.", { status: 403 });
