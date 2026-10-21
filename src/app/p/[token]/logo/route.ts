import { sql } from "@/lib/db";
import { studentByParentToken } from "@/lib/parent";

export async function GET(_req: Request, ctx: RouteContext<"/p/[token]/logo">) {
  const { token } = await ctx.params;
  const s = await studentByParentToken(token);
  if (!s?.has_logo) return new Response("Introuvable", { status: 404 });
  const [row] = await sql<{ logo_data: Buffer; logo_mime: string | null }[]>`
    select logo_data, logo_mime from schools where id = ${s.school_id}`;
  return new Response(new Uint8Array(row.logo_data), {
    headers: { "Content-Type": row.logo_mime ?? "image/png", "Cache-Control": "private, max-age=86400" },
  });
}
