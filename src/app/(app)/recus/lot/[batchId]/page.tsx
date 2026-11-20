import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { isUuid } from "@/lib/actions";
import { sql } from "@/lib/db";
import { PAYMENT_METHODS, formatDate, studentFullName, type PaymentMethod } from "@/lib/labels";
import { emptyTotals, formatMoney, formatTotals, type Currency } from "@/lib/money";
import { whatsAppLink } from "@/lib/phone";
import { parentLink } from "@/lib/app-url";
import { Alert, Card, LinkButton, Table, Td, buttonClass } from "@/components/ui";

export const metadata = { title: "Reçus du paiement" };

/** Paiement de plusieurs frais en une fois : la liste des reçus créés, à imprimer ou envoyer au parent. */
export default async function BatchReceiptPage(props: PageProps<"/recus/lot/[batchId]">) {
  const { batchId } = await props.params;
  const sp = await props.searchParams;
  const { school } = await requireSchoolUser();
  if (!isUuid(batchId)) notFound();

  const rows = await sql<{
    id: string; receipt_number: string; payment_date: Date; amount_cents: bigint; currency: Currency;
    cash_cents: bigint; cash_currency: Currency; payment_method: PaymentMethod; status: string;
    fee_name: string; due_date: Date | null; student_id: string; last_name: string; middle_name: string | null;
    first_name: string | null; class_name: string | null; parent_phone: string | null; parent_token: string;
  }[]>`
    select p.id, p.receipt_number, p.payment_date, p.amount_cents, p.currency, p.payment_method, p.status,
           coalesce(p.received_cents, p.amount_cents) as cash_cents, coalesce(p.received_currency, p.currency) as cash_currency,
           f.name as fee_name, f.due_date, s.id as student_id, s.last_name, s.middle_name, s.first_name,
           s.parent_phone, s.parent_token, c.name as class_name
    from payments p join fees f on f.id = p.fee_id join students s on s.id = p.student_id
    left join classes c on c.id = s.class_id
    where p.batch_id = ${batchId} and p.school_id = ${school.id}
    order by f.due_date nulls last, p.created_at`;
  if (rows.length === 0) notFound();

  const first = rows[0];
  const name = studentFullName(first);
  const valid = rows.filter((r) => r.status === "valid");
  const cash = emptyTotals();
  for (const r of valid) cash[r.cash_currency] += r.cash_cents;
  const message =
    `${school.name}\nPaiement du ${formatDate(first.payment_date)} pour ${name} (${first.class_name ?? "—"}) :\n` +
    valid.map((r) => `- ${r.fee_name} : ${formatMoney(r.amount_cents, r.currency)} (reçu ${r.receipt_number})`).join("\n") +
    `\nTotal reçu : ${formatTotals(cash)}\nTous les reçus : ${await parentLink(first.parent_token)}\nMerci.`;

  return (
    <div className="mx-auto max-w-2xl">
      {sp.nouveau && <div className="mb-4"><Alert kind="success">{rows.length} frais payés. Un reçu a été créé pour chacun.</Alert></div>}
      <div className="mb-4 flex flex-wrap gap-2">
        <a href={whatsAppLink(first.parent_phone, message)} target="_blank" rel="noopener" className={buttonClass("success")}>Envoyer le récapitulatif par WhatsApp</a>
        <LinkButton href={`/eleves/${first.student_id}`} variant="ghost">Fiche de l&apos;élève</LinkButton>
      </div>
      <Card title={`${name} · ${first.class_name ?? "Sans classe"}`}>
        <p className="mb-3 text-sm text-muted">
          Payé le {formatDate(first.payment_date)} · {PAYMENT_METHODS[first.payment_method]} · total reçu{" "}
          <strong className="text-green-800">{formatTotals(cash)}</strong>
        </p>
        <Table head={["Frais", "Montant", "Date limite", "Reçu", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className={r.status === "cancelled" ? "text-gray-400 line-through" : ""}>
              <Td className="font-medium">{r.fee_name}</Td>
              <Td className="tabular-nums">{formatMoney(r.amount_cents, r.currency)}</Td>
              <Td>{formatDate(r.due_date)}</Td>
              <Td><Link className="font-mono text-xs text-brand-600 hover:underline" href={`/recus/${r.id}`}>{r.receipt_number}</Link></Td>
              <Td><a className="text-sm text-brand-600 hover:underline" href={`/api/recus/${r.id}/pdf`} target="_blank" rel="noopener">PDF</a></Td>
            </tr>
          ))}
        </Table>
      </Card>
      <p className="mt-4 text-center text-sm">
        <Link href="/paiements/nouveau" className="font-medium text-brand-600 hover:underline">+ Encaisser un autre paiement</Link>
      </p>
    </div>
  );
}
