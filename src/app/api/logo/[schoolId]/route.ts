import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";

export async function GET(_req: Request, ctx: RouteContext<"/api/logo/[schoolId]">) {
  const { schoolId } = await ctx.params;
  if (!isUuid(schoolId)) return new Response("Introuvable", { status: 404 });
  const user = await getCurrentUser();
  // Seuls les membres de l'école (ou l'administrateur plateforme) voient le logo.
  if (!user || (user.role !== "super_admin" && user.school_id !== schoolId)) {
    return new Response("Non autorisé", { status: 401 });
  }
  const [row] = await sql<{ logo_data: Buffer | null; logo_mime: string | null }[]>`
    select logo_data, logo_mime from schools where id = ${schoolId}`;
  if (!row?.logo_data) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(row.logo_data), {
    headers: { "Content-Type": row.logo_mime ?? "image/png", "Cache-Control": "private, max-age=86400" },
  });
}
