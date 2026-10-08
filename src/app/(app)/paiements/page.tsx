import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { isISODate } from "@/lib/actions";
import { PAYMENT_METHODS, formatDate, studentFullName, todayISO } from "@/lib/labels";
import { emptyTotals, formatMoney } from "@/lib/money";
import { listPayments, monthStartISO } from "@/lib/reports";
import { MobileList, MobileRow } from "@/components/mobile-list";
import { Badge, Card, Field, Input, LinkButton, PageHeader, Select, StatCard, Table, Td, buttonClass, MoneyLines } from "@/components/ui";

export const metadata = { title: "Paiements" };

export default async function PaymentsPage(props: PageProps<"/paiements">) {
  const sp = await props.searchParams;
  const { school } = await requireSchoolUser();
  const today = todayISO();
  const from = typeof sp.du === "string" && isISODate(sp.du) ? sp.du : monthStartISO(today);
  const to = typeof sp.au === "string" && isISODate(sp.au) ? sp.au : today;
  const method = typeof sp.moyen === "string" && sp.moyen in PAYMENT_METHODS ? sp.moyen : "";

  const payments = await listPayments(school.id, { from, to, method: method || undefined, limit: 500 });
  const totals = emptyTotals();
  for (const p of payments) if (p.status === "valid") totals[p.currency] += p.amount_cents;
  const valid = payments.filter((p) => p.status === "valid").length;
  const qs = new URLSearchParams({ du: from, au: to, moyen: method }).toString();

  return (
    <>
      <PageHeader
        title="Paiements"
        actions={
          <>
            <LinkButton href="/paiements/nouveau" variant="success">+ Encaisser un paiement</LinkButton>
            <a href={`/api/export/paiements?${qs}`} className={buttonClass("secondary")}>Exporter Excel</a>
          </>
        }
      />
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <Field label="Du"><Input type="date" name="du" defaultValue={from} /></Field>
          <Field label="Au"><Input type="date" name="au" defaultValue={to} /></Field>
          <Field label="Moyen de paiement">
            <Select name="moyen" defaultValue={method}>
              <option value="">Tous</option>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <button className={buttonClass("primary")}>Filtrer</button>
        </form>
      </Card>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatCard label={`Total encaissé du ${formatDate(from)} au ${formatDate(to)}`} value={<MoneyLines totals={totals} />} tone="green" />
        <StatCard label="Nombre de paiements" value={valid} hint={payments.length > valid ? `${payments.length - valid} annulé(s) non comptés` : undefined} />
      </div>
      <Card className="overflow-hidden p-0 sm:p-0">
        <MobileList empty="Aucun paiement sur cette période.">
          {payments.map((p) => (
            <MobileRow
              key={p.id}
              href={`/recus/${p.id}`}
              title={studentFullName(p)}
              subtitle={`${formatDate(p.payment_date)} · ${p.fee_name}`}
              right={<span className={p.status === "cancelled" ? "text-muted line-through" : "text-green-800"}>{formatMoney(p.amount_cents, p.currency)}</span>}
              rightSub={p.status === "cancelled" ? <Badge color="red">Annulé</Badge> : <span className="text-muted">{PAYMENT_METHODS[p.payment_method]}</span>}
            />
          ))}
        </MobileList>
        <div className="hidden sm:block">
        <Table head={["Date", "Reçu", "Élève", "Frais", "Montant", "Moyen", "Agent"]} empty="Aucun paiement sur cette période.">
          {payments.map((p) => (
            <tr key={p.id} className={p.status === "cancelled" ? "text-gray-400" : ""}>
              <Td>{formatDate(p.payment_date)}</Td>
              <Td>
                <Link href={`/recus/${p.id}`} className="font-mono text-xs text-brand-600 hover:underline">{p.receipt_number}</Link>
                {p.status === "cancelled" && <span className="ml-2"><Badge color="red">Annulé</Badge></span>}
              </Td>
              <Td><Link href={`/eleves/${p.student_id}`} className="hover:underline">{studentFullName(p)}</Link><div className="text-xs text-muted">{p.class_name ?? "—"}</div></Td>
              <Td>{p.fee_name}</Td>
              <Td className={p.status === "cancelled" ? "line-through" : "font-semibold text-green-700"}>{formatMoney(p.amount_cents, p.currency)}</Td>
              <Td>{PAYMENT_METHODS[p.payment_method]}</Td>
              <Td>{p.agent}</Td>
            </tr>
          ))}
        </Table>
        </div>
      </Card>
      {payments.length === 500 && <p className="mt-2 text-center text-xs text-muted">500 paiements affichés au maximum : réduisez la période ou utilisez l&apos;export Excel.</p>}
    </>
  );
}
