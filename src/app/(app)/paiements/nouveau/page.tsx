import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";
import { PAYMENT_METHODS, studentFullName, todayISO } from "@/lib/labels";
import { centsToInput, formatMoney, formatTotals } from "@/lib/money";
import { studentFeeLines, totalsFromLines } from "@/lib/finance";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Card, Field, Input, LinkButton, PageHeader, Textarea, buttonClass } from "@/components/ui";
import { FeeAmountPicker } from "./amount-picker";
import { createPayment } from "../actions";

export const metadata = { title: "Encaisser un paiement" };

export default async function NewPaymentPage(props: PageProps<"/paiements/nouveau">) {
  const sp = await props.searchParams;
  const { school } = await requireSchoolUser();
  const studentId = typeof sp.eleve === "string" && isUuid(sp.eleve) ? sp.eleve : null;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  if (!studentId) {
    const like = `%${q.toLowerCase()}%`;
    const results = q
      ? await sql<{ id: string; student_number: string; last_name: string; middle_name: string | null; first_name: string | null; class_name: string | null }[]>`
          select s.id, s.student_number, s.last_name, s.middle_name, s.first_name, c.name as class_name
          from students s left join classes c on c.id = s.class_id
          where s.school_id = ${school.id} and s.status = 'active'
            and (lower(s.last_name || ' ' || coalesce(s.middle_name, '') || ' ' || coalesce(s.first_name, '')) like ${like}
                 or lower(s.student_number) like ${like})
          order by s.last_name limit 20`
      : [];
    return (
      <>
        <PageHeader title="Encaisser un paiement" subtitle="Étape 1 : trouver l'élève" />
        <Card>
          <form className="flex gap-2">
            <Input name="q" defaultValue={q} placeholder="Nom ou matricule de l'élève" type="search" autoFocus aria-label="Rechercher un élève" />
            <button className={buttonClass("primary")}>Rechercher</button>
          </form>
          {q && (
            <ul className="mt-4 divide-y divide-line">
              {results.map((s) => (
                <li key={s.id}>
                  <Link href={`/paiements/nouveau?eleve=${s.id}`} className="flex min-h-12 items-center justify-between gap-3 px-2 py-2 hover:bg-gray-50">
                    <span className="font-semibold text-brand-700">{studentFullName(s)}</span>
                    <span className="text-sm text-muted">{s.class_name ?? "—"} · {s.student_number}</span>
                  </Link>
                </li>
              ))}
              {results.length === 0 && <li className="py-4 text-sm text-muted">Aucun élève actif trouvé pour « {q} ».</li>}
            </ul>
          )}
        </Card>
      </>
    );
  }

  const [student] = await sql<{ id: string; student_number: string; last_name: string; middle_name: string | null; first_name: string | null; status: string; class_name: string | null }[]>`
    select s.id, s.student_number, s.last_name, s.middle_name, s.first_name, s.status, c.name as class_name
    from students s left join classes c on c.id = s.class_id
    where s.id = ${studentId} and s.school_id = ${school.id}`;
  if (!student) {
    return <Alert kind="error">Élève introuvable. <Link href="/paiements/nouveau" className="underline">Chercher à nouveau</Link></Alert>;
  }
  const lines = await studentFeeLines(school.id, studentId, school.academic_year);
  const totals = totalsFromLines(lines);
  const open = lines.filter((l) => l.remaining_cents > BigInt(0));
  const choices = open.map((l) => ({
    id: l.fee_id,
    label: `${l.name} — reste ${formatMoney(l.remaining_cents, l.currency)}`,
    remaining: centsToInput(l.remaining_cents),
    currency: l.currency,
  }));
  const initialFee = typeof sp.frais === "string" ? sp.frais : undefined;

  return (
    <>
      <PageHeader
        title="Encaisser un paiement"
        subtitle={<>{studentFullName(student)} · {student.class_name ?? "Sans classe"} · Matricule {student.student_number}</>}
        actions={<LinkButton href="/paiements/nouveau" variant="secondary">Changer d&apos;élève</LinkButton>}
      />
      {student.status !== "active" ? (
        <Alert kind="warning">Cet élève n&apos;est plus actif. Le directeur doit le réactiver avant tout encaissement.</Alert>
      ) : open.length === 0 ? (
        <Alert kind="success">
          {lines.length === 0
            ? "Aucun frais n'est défini pour la classe de cet élève. Le directeur peut les créer dans « Frais scolaires »."
            : "Cet élève a tout payé pour l'année. Aucun paiement à encaisser."}
        </Alert>
      ) : (
        <Card>
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            Solde restant de l&apos;élève : <strong>{formatTotals(totals.remaining)}</strong>
          </p>
          <ActionForm action={createPayment} className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="student_id" value={student.id} />
            <FeeAmountPicker fees={choices} initialFee={initialFee} />
            <fieldset className="sm:col-span-3">
              <legend className="mb-2 text-sm font-medium text-gray-700">Moyen de paiement *</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(PAYMENT_METHODS).map(([k, v], i) => (
                  <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:font-semibold">
                    <input type="radio" name="payment_method" value={k} defaultChecked={i === 0} required />
                    {v}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="N° de transaction" hint="Facultatif (Mobile Money, virement)">
              <Input name="transaction_number" />
            </Field>
            <Field label="Date du paiement *">
              <Input name="payment_date" type="date" required defaultValue={todayISO()} max={todayISO()} />
            </Field>
            <Field label="Commentaire" className="sm:col-span-3">
              <Textarea name="comment" rows={2} />
            </Field>
            <div className="sm:col-span-3">
              <SubmitButton variant="success" className="w-full sm:w-auto" pendingText="Enregistrement du paiement…">
                Enregistrer et générer le reçu
              </SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
