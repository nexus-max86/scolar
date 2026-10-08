import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PAYMENT_METHODS, formatDate, studentFullName, todayISO } from "@/lib/labels";
import { emptyTotals, formatMoney, type Currency } from "@/lib/money";
import { schoolBalances, sumTotals } from "@/lib/finance";
import { listPayments } from "@/lib/reports";
import { BarChart } from "@/components/bar-chart";
import { Alert, Card, LinkButton, PageHeader, StatCard, Table, Td, MoneyLines } from "@/components/ui";

export const metadata = { title: "Tableau de bord" };

const MONTH_LABELS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export default async function DashboardPage(props: PageProps<"/tableau-de-bord">) {
  const sp = await props.searchParams;
  const { user, school } = await requireSchoolUser();
  const today = todayISO();

  const [[counts], balances, todayPayments, monthly, perClass, recentStudents, recentPayments, [noFees]] = await Promise.all([
    sql<{ students: number; classes: number; staff: number }[]>`
      select (select count(*) from students where school_id = ${school.id} and status = 'active')::int as students,
             (select count(*) from classes where school_id = ${school.id} and academic_year = ${school.academic_year})::int as classes,
             (select count(*) from users where school_id = ${school.id} and status = 'active')::int as staff`,
    schoolBalances(school.id, school.academic_year),
    listPayments(school.id, { from: today, to: today }),
    sql<{ month: string; currency: Currency; total: bigint }[]>`
      select to_char(payment_date, 'YYYY-MM') as month, currency, sum(amount_cents)::bigint as total
      from payments
      where school_id = ${school.id} and status = 'valid' and payment_date > (${today}::date - interval '6 months')
      group by 1, 2 order by 1`,
    sql<{ name: string; n: number }[]>`
      select c.name, count(s.id)::int as n from classes c
      left join students s on s.class_id = c.id and s.status = 'active'
      where c.school_id = ${school.id} and c.academic_year = ${school.academic_year}
      group by c.id order by c.name`,
    sql<{ id: string; last_name: string; middle_name: string | null; first_name: string | null; class_name: string | null; enrolled_at: Date }[]>`
      select s.id, s.last_name, s.middle_name, s.first_name, c.name as class_name, s.enrolled_at
      from students s left join classes c on c.id = s.class_id
      where s.school_id = ${school.id} order by s.created_at desc limit 5`,
    listPayments(school.id, { from: "2000-01-01", to: today, limit: 6 }),
    sql<{ n: number }[]>`select count(*)::int as n from fees where school_id = ${school.id} and academic_year = ${school.academic_year} and not archived`,
  ]);

  const collected = sumTotals(balances, "paid_cents");
  const remaining = sumTotals(balances, "remaining_cents");
  const todayTotal = emptyTotals();
  for (const p of todayPayments) if (p.status === "valid") todayTotal[p.currency] += p.amount_cents;

  // Six derniers mois, y compris les mois sans paiement.
  const months: string[] = [];
  const base = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const monthData = (c: Currency) =>
    months.map((m) => ({
      label: `${MONTH_LABELS[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`,
      value: Number(monthly.find((r) => r.month === m && r.currency === c)?.total ?? 0) / 100,
    }));
  const hasCdf = monthly.some((r) => r.currency === "CDF");

  const alerts: React.ReactNode[] = [];
  if (sp.bienvenue) alerts.push(<Alert key="w" kind="success">Bienvenue ! L&apos;espace de votre école est prêt. Commencez par créer vos classes et vos frais, puis inscrivez ou importez vos élèves.</Alert>);
  if (sp.refus) alerts.push(<Alert key="r" kind="warning">Cette page est réservée au directeur.</Alert>);
  if (user.role === "director" && counts.classes === 0) alerts.push(<Alert key="c" kind="warning">Aucune classe créée. <Link href="/classes" className="font-semibold underline">Créer les classes</Link></Alert>);
  if (user.role === "director" && noFees.n === 0) alerts.push(<Alert key="f" kind="warning">Aucun frais scolaire défini : les soldes des élèves ne peuvent pas être calculés. <Link href="/frais" className="font-semibold underline">Définir les frais</Link></Alert>);

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={`Bonjour ${user.name} · Année scolaire ${school.academic_year}`}
        actions={
          <>
            <LinkButton href="/paiements/nouveau" variant="success">Encaisser un paiement</LinkButton>
            <LinkButton href="/eleves/nouveau" variant="secondary">Inscrire un élève</LinkButton>
          </>
        }
      />
      {alerts.length > 0 && <div className="mb-4 space-y-2">{alerts}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Élèves actifs" value={counts.students} />
        <StatCard label="Classes" value={counts.classes} />
        <StatCard label="Total encaissé (année)" value={<MoneyLines totals={collected} />} tone="green" />
        <StatCard label="Reste à percevoir" value={<MoneyLines totals={remaining} />} tone="red" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Encaissé aujourd'hui" value={<MoneyLines totals={todayTotal} />} tone="green" hint={`${todayPayments.filter((p) => p.status === "valid").length} paiement(s)`} />
        <StatCard label="Utilisateurs actifs" value={counts.staff} hint="Directeur et caissiers" />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title="Paiements par mois (USD)">
          <BarChart data={monthData("USD")} format={(v) => formatMoney(Math.round(v * 100), "USD")} color="bg-green-600" />
        </Card>
        {hasCdf ? (
          <Card title="Paiements par mois (CDF)">
            <BarChart data={monthData("CDF")} format={(v) => formatMoney(Math.round(v * 100), "CDF")} color="bg-green-600" />
          </Card>
        ) : (
          <Card title="Élèves par classe">
            <BarChart data={perClass.map((c) => ({ label: c.name, value: c.n }))} empty="Aucune classe." />
          </Card>
        )}
      </div>
      {hasCdf && (
        <Card title="Élèves par classe" className="mb-4">
          <BarChart data={perClass.map((c) => ({ label: c.name, value: c.n }))} empty="Aucune classe." />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Derniers paiements">
          <Table head={["Élève", "Montant", "Moyen", "Date"]} empty="Aucun paiement.">
            {recentPayments.map((p) => (
              <tr key={p.id} className={p.status === "cancelled" ? "text-gray-400 line-through" : ""}>
                <Td><Link href={`/recus/${p.id}`} className="text-brand-700 hover:underline">{studentFullName(p)}</Link></Td>
                <Td className="font-semibold text-green-700">{formatMoney(p.amount_cents, p.currency)}</Td>
                <Td>{PAYMENT_METHODS[p.payment_method]}</Td>
                <Td>{formatDate(p.payment_date)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Dernières inscriptions">
          <Table head={["Élève", "Classe", "Inscrit le"]} empty="Aucun élève.">
            {recentStudents.map((s) => (
              <tr key={s.id}>
                <Td><Link href={`/eleves/${s.id}`} className="text-brand-700 hover:underline">{studentFullName(s)}</Link></Td>
                <Td>{s.class_name ?? "—"}</Td>
                <Td>{formatDate(s.enrolled_at)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
