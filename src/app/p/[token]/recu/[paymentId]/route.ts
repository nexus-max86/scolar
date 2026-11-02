import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";
import { getReceipt } from "@/lib/payments";
import { receiptPdf } from "@/lib/receipt-pdf";
import { receiptFormat } from "@/lib/receipt-format";
import { studentByParentToken } from "@/lib/parent";

/** Reçu PDF téléchargé depuis l'espace parent : seulement les reçus de cet élève. */
export async function GET(req: Request, ctx: RouteContext<"/p/[token]/recu/[paymentId]">) {
  const { token, paymentId } = await ctx.params;
  const s = await studentByParentToken(token);
  if (!s || !isUuid(paymentId)) return new Response("Reçu introuvable", { status: 404 });
  const receipt = await getReceipt(s.school_id, paymentId);
  if (!receipt || receipt.student_id !== s.id) return new Response("Reçu introuvable", { status: 404 });

  let logo: { data: Buffer; mime: string } | null = null;
  if (receipt.has_logo) {
    const [row] = await sql<{ logo_data: Buffer; logo_mime: string }[]>`
      select logo_data, logo_mime from schools where id = ${s.school_id}`;
    logo = row ? { data: row.logo_data, mime: row.logo_mime } : null;
  }
  const format = await receiptFormat(req, null) // le parent reçoit le format A4, plus lisible sur téléphone;
  const bytes = await receiptPdf(receipt, logo, format);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recu-${receipt.receipt_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
