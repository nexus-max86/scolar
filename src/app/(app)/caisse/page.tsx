import { requireSchoolUser } from "@/lib/auth";
import { isISODate } from "@/lib/actions";
import { PAYMENT_METHODS, formatDate, studentFullName, todayISO, type PaymentMethod } from "@/lib/labels";
import { CURRENCIES, emptyTotals, formatMoney, type Totals } from "@/lib/money";
import { listPayments } from "@/lib/reports";
import { PrintButton } from "@/components/print-button";
import { Card, Field, Input, PageHeader, StatCard, Table, Td, buttonClass, MoneyLines } from "@/components/ui";

export const metadata = { title: "Caisse du jour" };

export default async function CashPage(props: PageProps<"/caisse">) {
  const sp = await props.searchParams;
  const { user, school } = await requireSchoolUser();
  const date = typeof sp.date === "string" && isISODate(sp.date) ? sp.date : todayISO();
  // Le caissier voit sa propre caisse ; le directeur voit celle de toute l'école.
  const payments = (await listPayments(school.id, {
    from: date, to: date, agent: user.role === "cashier" ? user.id : undefined,
  })).filter((p) => p.status === "valid");

  const total = emptyTotals();
  const byMethod = new Map<PaymentMethod, Totals>();
  const byAgent = new Map<string, Totals>();
  for (const p of payments) {
    total[p.cash_currency] += p.cash_cents;
    if (!byMethod.has(p.payment_method)) byMethod.set(p.payment_method, emptyTotals());
    byMethod.get(p.payment_method)![p.cash_currency] += p.cash_cents;
    if (!byAgent.has(p.agent)) byAgent.set(p.agent, emptyTotals());
    byAgent.get(p.agent)![p.cash_currency] += p.cash_cents;
  }
  const cash = byMethod.get("especes") ?? emptyTotals();

  return (
    <>
      <PageHeader
        title={`Caisse du ${formatDate(date)}`}
        subtitle={user.role === "cashier" ? "Vos encaissements de la journée" : "Tous les encaissements de l'école pour cette journée"}
        actions={
          <>
            <PrintButton />
            <a href={`/api/export/paiements?du=${date}&au=${date}`} className={buttonClass("secondary")}>Exporter Excel</a>
          </>
        }
      />
      <Card className="no-print mb-4">
        <form className="flex items-end gap-2">
          <Field label="Date"><Input type="date" name="date" defaultValue={date} max={todayISO()} /></Field>
          <button className={buttonClass("primary")}>Afficher</button>
        </form>
      </Card>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {CURRENCIES.map((c) => (
          <StatCard key={c} label={`Total encaissé (${c})`} value={formatMoney(total[c], c)} tone="green" />
        ))}
        <StatCard label="Espèces à remettre" value={<MoneyLines totals={cash} />} tone="orange" hint="À compter dans la caisse physique" />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title="Par moyen de paiement">
          <Table head={["Moyen", "USD", "CDF"]} empty="Aucun encaissement.">
            {[...byMethod.entries()].map(([m, t]) => (
              <tr key={m}><Td>{PAYMENT_METHODS[m]}</Td><Td>{formatMoney(t.USD, "USD")}</Td><Td>{formatMoney(t.CDF, "CDF")}</Td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Par agent">
          <Table head={["Agent", "USD", "CDF"]} empty="Aucun encaissement.">
            {[...byAgent.entries()].map(([a, t]) => (
              <tr key={a}><Td>{a}</Td><Td>{formatMoney(t.USD, "USD")}</Td><Td>{formatMoney(t.CDF, "CDF")}</Td></tr>
            ))}
          </Table>
        </Card>
      </div>
      <Card title={`Détail (${payments.length} paiement${payments.length > 1 ? "s" : ""})`} className="p-0 sm:p-0">
        <Table head={["Reçu", "Élève", "Frais", "Montant", "Moyen", "Agent"]} empty="Aucun paiement ce jour-là.">
          {payments.map((p) => (
            <tr key={p.id}>
              <Td className="font-mono text-xs">{p.receipt_number}</Td>
              <Td>{studentFullName(p)}</Td>
              <Td>{p.fee_name}</Td>
              <Td className="font-semibold">{formatMoney(p.cash_cents, p.cash_currency)}{p.cash_currency !== p.currency && <div className="text-xs font-normal text-muted">crédité {formatMoney(p.amount_cents, p.currency)}</div>}</Td>
              <Td>{PAYMENT_METHODS[p.payment_method]}{p.transaction_number ? ` · ${p.transaction_number}` : ""}</Td>
              <Td>{p.agent}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
