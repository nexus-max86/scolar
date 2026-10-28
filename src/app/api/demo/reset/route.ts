import { sql } from "@/lib/db";
import { resetDemoSchool } from "@/lib/demo-school";

export const maxDuration = 60;

/** Remise à zéro de l'école de démonstration, appelée chaque nuit par la tâche planifiée (vercel.json). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }
  const r = await resetDemoSchool(sql);
  return Response.json({ ok: true, ...r });
}
