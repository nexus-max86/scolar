import { sql } from "./db";
import type { ReceiptFormat } from "./receipt-pdf";

const FORMATS: ReceiptFormat[] = ["a4", "ticket58", "ticket80"];

/** Format demandé dans l'adresse (?format=ticket80), sinon celui choisi par l'école dans ses paramètres. */
export async function receiptFormat(req: Request, schoolId: string | null): Promise<ReceiptFormat> {
  const asked = new URL(req.url).searchParams.get("format") as ReceiptFormat | null;
  if (asked && FORMATS.includes(asked)) return asked;
  if (!schoolId) return "a4";
  const [s] = await sql<{ receipt_format: ReceiptFormat }[]>`select receipt_format from schools where id = ${schoolId}`;
  return s?.receipt_format ?? "a4";
}
