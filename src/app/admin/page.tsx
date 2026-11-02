import { requireSuperAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PLANS, SCHOOL_STATUS, formatDate, todayISO } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Wordmark, Badge, Card, Field, Input, PageHeader, Select, StatCard, Table, Td } from "@/components/ui";
import { logout } from "../(auth)/actions";
import { changeAdminPassword, updateSubscription } from "./actions";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const admin = await requireSuperAdmin();
  const [[stats], schools] = await Promise.all([
    sql<{ schools: number; active: number; students: number; users: number; usd: bigint; cdf: bigint }[]>`
      select (select count(*) from schools)::int as schools,
             (select count(*) from schools where status <> 'suspended')::int as active,
             (select count(*) from students where status = 'active')::int as students,
             (select count(*) from users where role <> 'super_admin')::int as users,
             (select coalesce(sum(amount_cents), 0) from payments where status = 'valid' and currency = 'USD')::bigint as usd,
             (select coalesce(sum(amount_cents), 0) from payments where status = 'valid' and currency = 'CDF')::bigint as cdf`,
    sql<{ id: string; name: string; city: string | null; phone: string | null; director_name: string | null; status: string;
          subscription_plan: string; subscription_end_date: Date | null; created_at: Date; students: number; users: number;
          last_payment: Date | null }[]>`
      select s.id, s.name, s.city, s.phone, s.director_name, s.status, s.subscription_plan, s.subscription_end_date, s.created_at,
             (select count(*) from students st where st.school_id = s.id and st.status = 'active')::int as students,
             (select count(*) from users u where u.school_id = s.id)::int as users,
             (select max(created_at) from payments p where p.school_id = s.id) as last_payment
      from schools s order by s.created_at desc`,
  ]);
  const today = todayISO();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <Wordmark />
        <form action={logout} className="flex items-center gap-3 text-sm">
          <span className="text-muted">{admin.name}</span>
          <button className="rounded-lg border border-gray-300 bg-white px-3 py-2">Se déconnecter</button>
        </form>
      </div>
      <PageHeader title="Écoles inscrites" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Écoles" value={stats.schools} hint={`${stats.active} non suspendue(s)`} />
        <StatCard label="Élèves actifs" value={stats.students} />
        <StatCard label="Utilisateurs" value={stats.users} />
        <StatCard label="Volume encaissé" value={formatMoney(stats.usd, "USD")} hint={formatMoney(stats.cdf, "CDF")} />
      </div>
      <Card className="p-0 sm:p-0">
        <Table head={["École", "Élèves", "Statut", "Formule", "Fin d'abonnement", "Dernier paiement", "Gérer"]} empty="Aucune école inscrite.">
          {schools.map((s) => {
            const end = s.subscription_end_date ? new Date(s.subscription_end_date).toISOString().slice(0, 10) : null;
            const expired = end !== null && end < today;
            return (
              <tr key={s.id} className="align-top">
                <Td><div className="font-semibold">{s.name}</div><div className="text-xs text-muted">{s.city ?? "—"} · {s.director_name ?? "—"} · {s.phone ?? ""}</div><div className="text-xs text-gray-400">Inscrite le {formatDate(s.created_at)}</div></Td>
                <Td>{s.students}<div className="text-xs text-muted">{s.users} utilisateur(s)</div></Td>
                <Td><Badge color={s.status === "suspended" ? "red" : s.status === "trial" ? "orange" : "green"}>{SCHOOL_STATUS[s.status]}</Badge></Td>
                <Td>{PLANS[s.subscription_plan]}</Td>
                <Td className={expired ? "font-semibold text-red-700" : ""}>{formatDate(s.subscription_end_date)}{expired && " (expiré)"}</Td>
                <Td>{formatDate(s.last_payment)}</Td>
                <Td>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-brand-700">Modifier</summary>
                    <ActionForm action={updateSubscription} className="mt-2 w-60 space-y-2 whitespace-normal">
                      <input type="hidden" name="id" value={s.id} />
                      <Field label="Statut">
                        <Select name="status" defaultValue={s.status}>
                          {Object.entries(SCHOOL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                      </Field>
                      <Field label="Formule">
                        <Select name="plan" defaultValue={s.subscription_plan}>
                          {Object.entries(PLANS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                      </Field>
                      <Field label="Fin d'abonnement"><Input type="date" name="end_date" defaultValue={end ?? ""} /></Field>
                      <SubmitButton>Enregistrer</SubmitButton>
                    </ActionForm>
                  </details>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <Card title="Mon mot de passe" className="mt-6 max-w-md">
        <ActionForm action={changeAdminPassword} resetOnSuccess>
          <Field label="Mot de passe actuel"><Input name="current" type="password" required autoComplete="current-password" /></Field>
          <Field label="Nouveau mot de passe" hint="10 caractères minimum"><Input name="next" type="password" required minLength={10} autoComplete="new-password" /></Field>
          <SubmitButton variant="secondary">Changer le mot de passe</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
