import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";
import { classLabel } from "@/lib/students";
import { PAYMENT_METHODS, STUDENT_STATUS, formatDate, studentFullName, type PaymentMethod } from "@/lib/labels";
import { formatMoney, type Currency } from "@/lib/money";
import { paymentStatus, STATUS_LABELS, studentFeeLines, totalsFromLines } from "@/lib/finance";
import { ConfirmActionButton } from "@/components/forms";
import { Alert, Badge, Card, LinkButton, PageHeader, StatCard, Table, Td, MoneyLines } from "@/components/ui";
import { setStudentStatus } from "../actions";

export const metadata = { title: "Fiche élève" };

export default async function StudentPage(props: PageProps<"/eleves/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { user, school } = await requireSchoolUser();
  if (!isUuid(id)) notFound();

  const [student] = await sql<
    { id: string; student_number: string; last_name: string; middle_name: string | null; first_name: string | null;
      birth_date: Date | null; gender: string | null; address: string | null; parent_name: string | null;
      parent_phone: string | null; status: keyof typeof STUDENT_STATUS; enrolled_at: Date;
      class_name: string | null; class_section: string | null }[]
  >`
    select s.*, c.name as class_name, c.section as class_section
    from students s left join classes c on c.id = s.class_id
    where s.id = ${id} and s.school_id = ${school.id}`;
  if (!student) notFound();

  const [lines, payments] = await Promise.all([
    studentFeeLines(school.id, id, school.academic_year),
    sql<{ id: string; receipt_number: string; payment_date: Date; amount_cents: bigint; currency: Currency;
          payment_method: PaymentMethod; fee_name: string; status: string; agent: string }[]>`
      select p.id, p.receipt_number, p.payment_date, p.amount_cents, p.currency, p.payment_method, p.status,
             f.name as fee_name, u.name as agent
      from payments p join fees f on f.id = p.fee_id join users u on u.id = p.recorded_by
      where p.student_id = ${id} and p.school_id = ${school.id}
      order by p.payment_date desc, p.created_at desc`,
  ]);
  const totals = totalsFromLines(lines);
  const st = paymentStatus(totals.due, totals.paid, totals.remaining);
  const name = studentFullName(student);

  return (
    <>
      {sp.cree && <div className="mb-4"><Alert kind="success">Élève inscrit avec le matricule {student.student_number}.</Alert></div>}
      {sp.modifie && <div className="mb-4"><Alert kind="success">Modifications enregistrées.</Alert></div>}
      <PageHeader
        title={name}
        subtitle={<>Matricule {student.student_number} · {classLabel(student.class_name ? { name: student.class_name, section: student.class_section } : null)} · <Badge color={student.status === "active" ? "green" : "gray"}>{STUDENT_STATUS[student.status]}</Badge></>}
        actions={
          <>
            {student.status === "active" && <LinkButton href={`/paiements/nouveau?eleve=${id}`} variant="success">Encaisser un paiement</LinkButton>}
            <LinkButton href={`/eleves/${id}/modifier`} variant="secondary">Modifier</LinkButton>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total à payer" value={<MoneyLines totals={totals.due} />} />
        <StatCard label="Déjà payé" value={<MoneyLines totals={totals.paid} />} tone="green" />
        <StatCard label="Solde restant" value={<MoneyLines totals={totals.remaining} />} tone={st === "paid" ? "green" : "red"} hint={STATUS_LABELS[st].label} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Frais de l'année" className="lg:col-span-2">
          <Table head={["Frais", "Montant", "Payé", "Reste", "Date limite"]} empty="Aucun frais défini pour cette classe. Le directeur peut les créer dans « Frais scolaires ».">
            {lines.map((l) => (
              <tr key={l.fee_id}>
                <Td className="font-medium">{l.name}</Td>
                <Td>{formatMoney(l.amount_cents, l.currency)}</Td>
                <Td className="text-green-700">{formatMoney(l.paid_cents, l.currency)}</Td>
                <Td className={l.remaining_cents > BigInt(0) ? "font-semibold text-red-700" : "text-green-700"}>
                  {l.remaining_cents > BigInt(0) ? formatMoney(l.remaining_cents, l.currency) : "Soldé"}
                </Td>
                <Td>{formatDate(l.due_date)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Informations">
          <dl className="space-y-2 text-sm">
            {[
              ["Sexe", student.gender === "M" ? "Masculin" : student.gender === "F" ? "Féminin" : "—"],
              ["Date de naissance", formatDate(student.birth_date)],
              ["Parent / tuteur", student.parent_name ?? "—"],
              ["Téléphone parent", student.parent_phone ?? "—"],
              ["Adresse", student.address ?? "—"],
              ["Inscrit le", formatDate(student.enrolled_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-gray-100 pb-2">
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {user.role === "director" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {student.status === "active" ? (
                <>
                  <ConfirmActionButton action={setStudentStatus} fields={{ id, status: "transferred" }} label="Marquer transféré" variant="secondary" confirmMessage={`Marquer ${name} comme transféré ?`} />
                  <ConfirmActionButton action={setStudentStatus} fields={{ id, status: "archived" }} label="Archiver" confirmMessage={`Archiver ${name} ? Il n'apparaîtra plus dans les listes, mais ses paiements sont conservés.`} />
                </>
              ) : (
                <ConfirmActionButton action={setStudentStatus} fields={{ id, status: "active" }} label="Réactiver" variant="secondary" confirmMessage={`Réactiver ${name} ?`} />
              )}
            </div>
          )}
        </Card>
      </div>

      <Card title="Historique des paiements" className="mt-4">
        <Table head={["Date", "Reçu", "Frais", "Montant", "Moyen", "Agent"]} empty="Aucun paiement enregistré.">
          {payments.map((p) => (
            <tr key={p.id} className={p.status === "cancelled" ? "text-gray-400 line-through" : ""}>
              <Td>{formatDate(p.payment_date)}</Td>
              <Td><Link className="font-mono text-xs text-brand-700 hover:underline" href={`/recus/${p.id}`}>{p.receipt_number}</Link></Td>
              <Td>{p.fee_name}</Td>
              <Td className="font-semibold">{formatMoney(p.amount_cents, p.currency)}</Td>
              <Td>{PAYMENT_METHODS[p.payment_method]}</Td>
              <Td>{p.agent}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
