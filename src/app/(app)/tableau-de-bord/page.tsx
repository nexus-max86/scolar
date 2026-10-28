import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PAYMENT_METHODS, formatDate, studentFullName, todayISO } from "@/lib/labels";
import { formatTotals, emptyTotals, formatMoney, type Currency } from "@/lib/money";
import { schoolBalances, sumTotals } from "@/lib/finance";
import { listPayments } from "@/lib/reports";
import { BarChart } from "@/components/bar-chart";
import { SetupChecklist } from "@/components/setup-checklist";
import { Alert, Card, MoneyLines, PageHeader, StatCard } from "@/components/ui";

export const metadata = { title: "Tableau de bord" };

const MONTH_LABELS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default async function DashboardPage(props: PageProps<"/tableau-de-bord">) {
  const sp = await props.searchParams;
  const { user, school } = await requireSchoolUser();
  const today = todayISO();

  const [[counts], balances, overdue, todayPayments, monthly, perClass, recentStudents, recentPayments] = await Promise.all([
    sql<{ students: number; classes: number; staff: number; fees: number }[]>`
      select (select count(*) from students where school_id = ${school.id} and status = 'active')::int as students,
             (select count(*) from classes where school_id = ${school.id} and academic_year = ${school.academic_year})::int as classes,
             (select count(*) from users where school_id = ${school.id} and status = 'active')::int as staff,
             (select count(*) from fees where school_id = ${school.id} and academic_year = ${school.academic_year} and not archived)::int as fees`,
    schoolBalances(school.id, school.academic_year),
    schoolBalances(school.id, school.academic_year, { overdueOnly: true }),
    listPayments(school.id, { from: today, to: today }),
    sql<{ month: string; currency: Currency; total: bigint }[]>`
      select to_char(payment_date, 'YYYY-MM') as month, currency, sum(amount_cents)::bigint as total
      from payments
      where school_id = ${school.id} and status = 'valid' and payment_date > (${today}::date - interval '6 months')
      group by 1, 2 order by 1`,
    sql<{ id: string; name: string; n: number }[]>`
      select c.id, c.name, count(s.id)::int as n from classes c
      left join students s on s.class_id = c.id and s.status = 'active'
      where c.school_id = ${school.id} and c.academic_year = ${school.academic_year}
      group by c.id order by c.name`,
    sql<{ id: string; last_name: string; middle_name: string | null; first_name: string | null; class_name: string | null; enrolled_at: Date }[]>`
      select s.id, s.last_name, s.middle_name, s.first_name, c.name as class_name, s.enrolled_at
      from students s left join classes c on c.id = s.class_id
      where s.school_id = ${school.id} order by s.created_at desc limit 5`,
    listPayments(school.id, { from: "2000-01-01", to: today, limit: 6 }),
  ]);

  const collected = sumTotals(balances, "paid_cents");
  const remaining = sumTotals(balances, "remaining_cents");
  const todayValid = todayPayments.filter((p) => p.status === "valid");
  const todayTotal = emptyTotals();
  for (const p of todayValid) todayTotal[p.currency] += p.amount_cents;
  const debtors = new Set(balances.filter((b) => b.remaining_cents > BigInt(0)).map((b) => b.student_id)).size;

  const lateIds = new Set(overdue.filter((b) => b.remaining_cents > BigInt(0)).map((b) => b.student_id));
  const lateTotal = sumTotals(overdue, "remaining_cents");

  const months: string[] = [];
  const base = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  for (let i = 5; i >= 0; i--) {
    months.push(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }
  // On masque les mois vides avant le premier encaissement (début d'utilisation).
  const firstActive = months.findIndex((m) => monthly.some((r) => r.month === m));
  if (firstActive > 0) months.splice(0, Math.min(firstActive, months.length - 2));
  const monthData = (c: Currency) =>
    months.map((m) => ({
      label: MONTH_LABELS[Number(m.slice(5)) - 1],
      value: Number(monthly.find((r) => r.month === m && r.currency === c)?.total ?? 0) / 100,
    }));
  const currencies: Currency[] = monthly.some((r) => r.currency === "CDF") ? ["USD", "CDF"] : ["USD"];

  const isDirector = user.role === "director";
  const firstName = user.name.split(" ")[0];
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kinshasa" });

  return (
    <>
      {sp.refus && <div className="mb-4"><Alert kind="warning">Cette page est réservée au directeur de l&apos;école.</Alert></div>}
      <PageHeader title={`Bonjour ${firstName}`} subtitle={<span className="block first-letter:uppercase">{dateLabel} · Année scolaire {school.academic_year}</span>} />

      {isDirector && !school.is_demo && (
        <SetupChecklist
          steps={[
            { done: counts.classes > 0, label: "Créer les classes", detail: "Par exemple « 6e primaire » ou « 1re humanités ».", href: "/classes", cta: "Créer" },
            { done: counts.fees > 0, label: "Définir les frais scolaires", detail: "Inscription, minerval, mensualités… en dollars ou en francs.", href: "/frais", cta: "Définir" },
            { done: counts.students > 0, label: "Ajouter les élèves", detail: "Un par un, ou tous d'un coup depuis un fichier Excel.", href: "/eleves/import", cta: "Ajouter" },
            { done: counts.staff > 1, label: "Créer le compte du caissier", detail: "Il pourra encaisser et imprimer les reçus.", href: "/utilisateurs", cta: "Créer" },
            { done: school.has_logo, label: "Ajouter le logo de l'école", detail: "Il apparaîtra sur chaque reçu.", href: "/parametres", cta: "Ajouter" },
          ]}
        />
      )}

      {lateIds.size > 0 && (
        <Link href="/impayes?echus=1" className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition-colors hover:border-amber-300">
          <span>
            <strong>{lateIds.size} élève{lateIds.size > 1 ? "s" : ""} en retard</strong> de paiement (date limite dépassée) : {formatTotals(lateTotal)}.
          </span>
          <span className="shrink-0 font-semibold">Relancer les parents →</span>
        </Link>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Encaissé aujourd'hui" value={<MoneyLines totals={todayTotal} />} tone="green" hint={`${todayValid.length} paiement${todayValid.length > 1 ? "s" : ""}`} href="/caisse" />
        <StatCard label="Encaissé cette année" value={<MoneyLines totals={collected} />} href="/paiements" />
        <StatCard label="Reste à percevoir" value={<MoneyLines totals={remaining} />} tone="red" hint={`${debtors} élève${debtors > 1 ? "s" : ""} concerné${debtors > 1 ? "s" : ""}`} href="/impayes" />
        <StatCard label="Élèves actifs" value={counts.students} hint={`${counts.classes} classe${counts.classes > 1 ? "s" : ""}`} href="/eleves" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {currencies.map((c) => (
          <Card key={c} title={`Encaissements par mois (${c})`}>
            <BarChart data={monthData(c)} format={(v) => formatMoney(Math.round(v * 100), c)} />
          </Card>
        ))}
        {currencies.length === 1 && (
          <Card title="Élèves par classe">
            <BarChart data={perClass.map((c) => ({ label: c.name, value: c.n }))} empty="Aucune classe pour le moment." />
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Derniers paiements" action={<Link href="/paiements" className="text-sm text-brand-600 hover:underline">Tout voir</Link>}>
          {recentPayments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Aucun paiement pour le moment.</p>
          ) : (
            <ul className="-my-2 divide-y divide-line">
              {recentPayments.map((p) => (
                <li key={p.id}>
                  <Link href={`/recus/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-gray-50">
                    <div className="min-w-0">
                      <div className={p.status === "cancelled" ? "truncate text-sm text-muted line-through" : "truncate text-sm font-medium"}>{studentFullName(p)}</div>
                      <div className="text-xs text-muted">{formatDate(p.payment_date)} · {PAYMENT_METHODS[p.payment_method]}</div>
                    </div>
                    <span className={p.status === "cancelled" ? "text-sm text-muted line-through" : "text-sm font-semibold tabular-nums text-green-800"}>
                      {formatMoney(p.amount_cents, p.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Dernières inscriptions" action={<Link href="/eleves/nouveau" className="text-sm text-brand-600 hover:underline">Inscrire un élève</Link>}>
          {recentStudents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Aucun élève inscrit.</p>
          ) : (
            <ul className="-my-2 divide-y divide-line">
              {recentStudents.map((s) => (
                <li key={s.id}>
                  <Link href={`/eleves/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-gray-50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{studentFullName(s)}</div>
                      <div className="text-xs text-muted">{s.class_name ?? "Sans classe"}</div>
                    </div>
                    <span className="text-xs text-muted">{formatDate(s.enrolled_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {currencies.length > 1 && (
        <Card title="Élèves par classe" className="mt-4">
          <BarChart data={perClass.map((c) => ({ label: c.name, value: c.n }))} empty="Aucune classe pour le moment." />
        </Card>
      )}
    </>
  );
}
