import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";
import { getReceipt } from "@/lib/payments";
import { receiptPdf } from "@/lib/receipt-pdf";
import { forbidden, routeSchoolUser } from "@/lib/route-auth";

export async function GET(_req: Request, ctx: RouteContext<"/api/recus/[id]/pdf">) {
  const { id } = await ctx.params;
  const auth = await routeSchoolUser();
  if (!auth) return forbidden();
  if (!isUuid(id)) return new Response("Reçu introuvable", { status: 404 });
  const receipt = await getReceipt(auth.school.id, id);
  if (!receipt) return new Response("Reçu introuvable", { status: 404 });

  let logo: { data: Buffer; mime: string } | null = null;
  if (receipt.has_logo) {
    const [row] = await sql<{ logo_data: Buffer; logo_mime: string }[]>`
      select logo_data, logo_mime from schools where id = ${auth.school.id}`;
    logo = row ? { data: row.logo_data, mime: row.logo_mime } : null;
  }
  const bytes = await receiptPdf(receipt, logo);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recu-${receipt.receipt_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
