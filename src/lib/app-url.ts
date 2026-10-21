import { headers } from "next/headers";

/** Adresse publique du site (ex. https://scolar.cd), pour construire les liens envoyés aux parents. */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function parentLink(token: string): Promise<string> {
  return `${await appUrl()}/p/${token}`;
}
