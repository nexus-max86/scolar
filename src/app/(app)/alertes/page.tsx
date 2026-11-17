import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ALERT_KINDS, type AlertKind } from "@/lib/alerts";
import { formatDate, studentFullName } from "@/lib/labels";
import { formatMoney, type Currency } from "@/lib/money";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, PageHeader, cx } from "@/components/ui";
import { markAlertsRead } from "./actions";

export const metadata = { title: "Alertes" };

export default async function AlertsPage() {
  const { school } = await requireSchoolUser(["director"]);

  const [alerts, sameNames, samePayments] = await Promise.all([
    sql<{ id: string; kind: AlertKind; title: string; body: string | null; link: string | null; created_at: Date; read_at: Date | null; author: string | null }[]>`
      select a.id, a.kind, a.title, a.body, a.link, a.created_at, a.read_at, u.name as author
      from alerts a left join users u on u.id = a.created_by
      where a.school_id = ${school.id}
      order by a.read_at is null desc, a.created_at desc limit 100`,
    // Élèves actifs qui portent exactement le même nom complet.
    sql<{ key: string; students: { id: string; number: string; class_name: string | null; last_name: string; middle_name: string | null; first_name: string | null }[] }[]>`
      select lower(regexp_replace(s.last_name || ' ' || coalesce(s.middle_name, '') || ' ' || coalesce(s.first_name, ''), '\s+', ' ', 'g')) as key,
             json_agg(json_build_object('id', s.id, 'number', s.student_number, 'class_name', c.name,
                      'last_name', s.last_name, 'middle_name', s.middle_name, 'first_name', s.first_name) order by s.created_at) as students
      from students s left join classes c on c.id = s.class_id
      where s.school_id = ${school.id} and s.status = 'active'
      group by 1 having count(*) > 1
      order by 1 limit 50`,
    // Paiements identiques : même élève, même frais, même montant, même jour.
    sql<{ receipts: { id: string; number: string }[]; fee_name: string; amount_cents: bigint; currency: Currency; payment_date: Date;
          last_name: string; middle_name: string | null; first_name: string | null }[]>`
      select json_agg(json_build_object('id', p.id, 'number', p.receipt_number) order by p.created_at) as receipts,
             f.name as fee_name, p.amount_cents, p.currency, p.payment_date, s.last_name, s.middle_name, s.first_name
      from payments p join fees f on f.id = p.fee_id join students s on s.id = p.student_id
      where p.school_id = ${school.id} and p.status = 'valid'
      group by p.student_id, p.fee_id, p.amount_cents, p.currency, p.payment_date, f.name, s.last_name, s.middle_name, s.first_name
      having count(*) > 1
      order by p.payment_date desc limit 50`,
  ]);
  const unread = alerts.filter((a) => !a.read_at).length;

  return (
    <>
      <PageHeader
        title="Alertes"
        subtitle="Ce qui mérite votre attention : imports en erreur, doublons, montants ou taux inhabituels, opérations qui n'ont pas abouti."
        actions={unread > 0 ? (
          <ActionForm action={markAlertsRead} className="inline">
            <SubmitButton variant="secondary" pendingText="…">Tout marquer comme vu</SubmitButton>
          </ActionForm>
        ) : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={unread ? `${unread} nouvelle${unread > 1 ? "s" : ""} alerte${unread > 1 ? "s" : ""}` : "Alertes"} className="lg:col-span-2">
          {alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Aucune alerte. Tout va bien.</p>
          ) : (
            <ul className="-my-2 divide-y divide-line">
              {alerts.map((a) => (
                <li key={a.id} className={cx("flex gap-3 py-3", a.read_at && "opacity-60")}>
                  <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.read_at ? "bg-gray-300" : "bg-red-500")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={ALERT_KINDS[a.kind].color}>{ALERT_KINDS[a.kind].label}</Badge>
                      <span className="text-xs text-muted">
                        {new Date(a.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Kinshasa", dateStyle: "short", timeStyle: "short" })}
                        {a.author && ` · ${a.author}`}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-ink">{a.title}</div>
                    {a.body && <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{a.body}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm">
                      {a.link && <Link href={a.link} className="font-medium text-brand-600 hover:underline">Voir</Link>}
                      {!a.read_at && (
                        <ActionForm action={markAlertsRead} className="inline">
                          <input type="hidden" name="id" value={a.id} />
                          <button className="text-muted hover:text-ink">Marquer comme vu</button>
                        </ActionForm>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Élèves en double possibles">
            {sameNames.length === 0 ? (
              <p className="text-sm text-muted">Aucun élève actif ne porte le même nom qu&apos;un autre.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {sameNames.map((g) => (
                  <li key={g.key} className="rounded-lg bg-canvas px-3 py-2">
                    <div className="font-medium">{studentFullName(g.students[0])}</div>
                    <ul className="mt-1 space-y-0.5">
                      {g.students.map((s) => (
                        <li key={s.id}>
                          <Link href={`/eleves/${s.id}`} className="text-brand-600 hover:underline">Matricule {s.number}</Link>
                          <span className="text-muted"> · {s.class_name ?? "sans classe"}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">S&apos;il s&apos;agit du même enfant, archivez la fiche en trop (ses paiements restent conservés).</p>
          </Card>
          <Card title="Paiements en double possibles">
            {samePayments.length === 0 ? (
              <p className="text-sm text-muted">Aucun paiement identique (même élève, frais, montant et jour).</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {samePayments.map((p, i) => (
                  <li key={i} className="rounded-lg bg-canvas px-3 py-2">
                    <div className="font-medium">{studentFullName(p)}</div>
                    <div className="text-muted">{p.fee_name} · {formatMoney(p.amount_cents, p.currency)} · {formatDate(p.payment_date)}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3">
                      {p.receipts.map((r) => <Link key={r.id} href={`/recus/${r.id}`} className="font-mono text-xs text-brand-600 hover:underline">{r.number}</Link>)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">Une erreur de saisie ? Ouvrez le reçu en trop et annulez-le avec un motif.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
