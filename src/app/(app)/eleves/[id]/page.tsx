import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";
import { classLabel } from "@/lib/students";
import { PAYMENT_METHODS, STUDENT_STATUS, formatDate, studentFullName, type PaymentMethod } from "@/lib/labels";
import { formatMoney, type Currency } from "@/lib/money";
import { optionalFeesFor, paymentStatus, STATUS_LABELS, studentFeeLines, totalsFromLines } from "@/lib/finance";
import { parentLink } from "@/lib/app-url";
import { whatsAppLink } from "@/lib/phone";
import { ActionForm, ConfirmActionButton, SubmitButton } from "@/components/forms";
import { CopyButton } from "@/components/copy-button";
import { Alert, Badge, Card, Input, LinkButton, PageHeader, Select, StatCard, Table, Td, MoneyLines, buttonClass } from "@/components/ui";
import { setStudentStatus } from "../actions";
import { adjustFee, enrollOptional, removeAdjustment, resetParentLink } from "../ajustements";

export const metadata = { title: "Fiche élève" };

export default async function StudentPage(props: PageProps<"/eleves/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { user, school } = await requireSchoolUser();
  if (!isUuid(id)) notFound();

  const [student] = await sql<
    { id: string; student_number: string; last_name: string; middle_name: string | null; first_name: string | null;
      birth_date: Date | null; gender: string | null; address: string | null; parent_name: string | null;
      parent_phone: string | null; status: keyof typeof STUDENT_STATUS; enrolled_at: Date; parent_token: string;
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
  const optionalFees = await optionalFeesFor(school.id, id, school.academic_year);
  // Les mensualités d'un même frais optionnel (« Transport – Septembre », « Transport – Octobre »…) sont regroupées.
  const optionalGroups = new Map<string, { id: string; name: string; amount_cents: bigint; currency: Currency }[]>();
  for (const f of optionalFees) {
    const key = f.name.split(" – ")[0];
    optionalGroups.set(key, [...(optionalGroups.get(key) ?? []), f]);
  }
  const link = await parentLink(student.parent_token);
  const isDirector = user.role === "director";
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
            {lines.map((l) => {
              const exempt = l.amount_cents === BigInt(0);
              return (
                <tr key={l.fee_id} className="align-top">
                  <Td>
                    <div className="font-medium">{l.name}</div>
                    {l.adjusted && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge color={exempt ? "gray" : "blue"}>{exempt ? "Exempté" : l.optional && l.amount_cents === l.base_amount_cents ? "Optionnel" : "Montant ajusté"}</Badge>
                        {l.adjust_reason && !l.optional && <span className="text-xs text-muted">{l.adjust_reason}</span>}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {formatMoney(l.amount_cents, l.currency)}
                    {l.amount_cents !== l.base_amount_cents && <div className="text-xs text-muted line-through">{formatMoney(l.base_amount_cents, l.currency)}</div>}
                  </Td>
                  <Td className="text-green-700">{formatMoney(l.paid_cents, l.currency)}</Td>
                  <Td className={l.remaining_cents > BigInt(0) ? "font-semibold text-red-700" : "text-green-700"}>
                    {exempt ? "—" : l.remaining_cents > BigInt(0) ? formatMoney(l.remaining_cents, l.currency) : "Soldé"}
                  </Td>
                  <Td>{formatDate(l.due_date)}</Td>
                </tr>
              );
            })}
          </Table>
          {isDirector && lines.length > 0 && (
            <details className="mt-4 border-t border-line pt-4">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">Accorder une réduction ou une exemption</summary>
              <ActionForm action={adjustFee} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="student_id" value={id} />
                <Select name="fee_id" aria-label="Frais concerné" className="sm:col-span-2">
                  {lines.map((l) => <option key={l.fee_id} value={l.fee_id}>{l.name} ({formatMoney(l.base_amount_cents, l.currency)})</option>)}
                </Select>
                <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm sm:col-span-2">
                  <label className="flex items-center gap-2"><input type="radio" name="mode" value="percent" defaultChecked /> Réduction en %</label>
                  <label className="flex items-center gap-2"><input type="radio" name="mode" value="amount" /> Montant à payer</label>
                  <label className="flex items-center gap-2"><input type="radio" name="mode" value="exempt" /> Exempté (rien à payer)</label>
                </fieldset>
                <Input name="value" inputMode="decimal" placeholder="Ex. 50 (%) ou 40 ($)" aria-label="Valeur" />
                <Input name="reason" placeholder="Motif : fratrie, enfant du personnel…" aria-label="Motif" />
                <div className="sm:col-span-2"><SubmitButton>Appliquer</SubmitButton></div>
              </ActionForm>
              {lines.some((l) => l.adjusted) && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs text-muted">Montants particuliers en cours</div>
                  {lines.filter((l) => l.adjusted).map((l) => (
                    <div key={l.fee_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
                      <span>{l.name} : {l.amount_cents === BigInt(0) ? "exempté" : formatMoney(l.amount_cents, l.currency)}</span>
                      <ConfirmActionButton
                        action={removeAdjustment}
                        fields={{ student_id: id, fee_id: l.fee_id }}
                        label={l.optional ? "Désinscrire" : "Revenir au montant normal"}
                        variant="secondary"
                        confirmMessage={l.optional ? `Désinscrire l'élève de « ${l.name} » ?` : `Revenir au montant normal pour « ${l.name} » ?`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </details>
          )}
          {optionalGroups.size > 0 && student.status === "active" && (
            <div className="mt-4 space-y-2 border-t border-line pt-4">
              <div className="text-sm font-medium">Frais optionnels disponibles</div>
              {[...optionalGroups.entries()].map(([group, fees]) => (
                <ActionForm key={group} action={enrollOptional} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
                  <input type="hidden" name="student_id" value={id} />
                  {fees.map((f) => <input key={f.id} type="hidden" name="fee_id" value={f.id} />)}
                  <span className="text-sm">
                    {group} · {formatMoney(fees[0].amount_cents, fees[0].currency)}
                    {fees.length > 1 && <span className="text-muted"> × {fees.length} échéances</span>}
                  </span>
                  <SubmitButton variant="secondary" pendingText="Inscription…">Inscrire l&apos;élève</SubmitButton>
                </ActionForm>
              ))}
            </div>
          )}
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
              <div key={k} className="flex justify-between gap-3 border-b border-line pb-2">
                <dt className="text-muted">{k}</dt>
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

      <Card title="Espace parent" className="mt-4">
        <p className="text-sm text-muted">
          Le parent suit le solde, les paiements et télécharge ses reçus depuis son téléphone, sans compte ni mot de passe.
          Ce lien est personnel : ne l&apos;envoyez qu&apos;au parent de l&apos;élève.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={whatsAppLink(student.parent_phone, `Bonjour ${student.parent_name ?? ""}, voici le lien pour suivre les frais scolaires de ${name} à ${school.name} : ${link}`)}
            target="_blank"
            rel="noopener"
            className={buttonClass("success")}
          >
            Envoyer le lien par WhatsApp
          </a>
          <CopyButton text={link} />
          <a href={link} target="_blank" rel="noopener" className={buttonClass("ghost")}>Voir ce que voit le parent</a>
          {isDirector && (
            <ConfirmActionButton
              action={resetParentLink}
              fields={{ student_id: id }}
              label="Changer le lien"
              variant="secondary"
              confirmMessage="Créer un nouveau lien ? L'ancien ne fonctionnera plus."
            />
          )}
        </div>
      </Card>

      <Card title="Historique des paiements" className="mt-4">
        <Table head={["Date", "Reçu", "Frais", "Montant", "Moyen", "Agent"]} empty="Aucun paiement enregistré.">
          {payments.map((p) => (
            <tr key={p.id} className={p.status === "cancelled" ? "text-gray-400 line-through" : ""}>
              <Td>{formatDate(p.payment_date)}</Td>
              <Td><Link className="font-mono text-xs text-brand-600 hover:underline" href={`/recus/${p.id}`}>{p.receipt_number}</Link></Td>
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
