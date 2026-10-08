import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { classLabel, classOptions } from "@/lib/students";
import { FEE_CATEGORIES, formatDate } from "@/lib/labels";
import { centsToInput, formatMoney, type Currency } from "@/lib/money";
import { ActionForm, ConfirmActionButton, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { createFee, removeFee, updateFee } from "./actions";

export const metadata = { title: "Frais scolaires" };

function FeeFields({ classes, d }: { classes: { id: string; name: string; section: string | null }[]; d?: { name: string; category: string; amount_cents: bigint; currency: string; due_date: Date | null; class_id: string | null } }) {
  return (
    <>
      <Field label="Type de frais *">
        <Select name="category" defaultValue={d?.category ?? "minerval"} required>
          {Object.entries(FEE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Libellé" hint="Ex. : Minerval 1er trimestre">
        <Input name="name" defaultValue={d?.name ?? ""} />
      </Field>
      <Field label="Montant *">
        <Input name="amount" inputMode="decimal" required defaultValue={d ? centsToInput(d.amount_cents) : ""} placeholder="50" />
      </Field>
      <Field label="Devise *">
        <Select name="currency" defaultValue={d?.currency ?? "USD"}>
          <option value="USD">Dollars (USD)</option>
          <option value="CDF">Francs congolais (CDF)</option>
        </Select>
      </Field>
      <Field label="Concerne">
        <Select name="class_id" defaultValue={d?.class_id ?? ""}>
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
        </Select>
      </Field>
      <Field label="Date limite de paiement">
        <Input name="due_date" type="date" defaultValue={d?.due_date ? new Date(d.due_date).toLocaleDateString("en-CA") : ""} />
      </Field>
    </>
  );
}

export default async function FeesPage() {
  const { school } = await requireSchoolUser(["director"]);
  const [classes, fees] = await Promise.all([
    classOptions(school.id, school.academic_year),
    sql<{ id: string; name: string; category: string; amount_cents: bigint; currency: Currency; due_date: Date | null;
          class_id: string | null; class_name: string | null; class_section: string | null; collected: bigint; payers: number }[]>`
      select f.id, f.name, f.category, f.amount_cents, f.currency, f.due_date, f.class_id,
             c.name as class_name, c.section as class_section,
             coalesce(sum(p.amount_cents) filter (where p.status = 'valid'), 0)::bigint as collected,
             count(distinct p.student_id) filter (where p.status = 'valid')::int as payers
      from fees f
      left join classes c on c.id = f.class_id
      left join payments p on p.fee_id = f.id
      where f.school_id = ${school.id} and f.academic_year = ${school.academic_year} and not f.archived
      group by f.id, c.id
      order by f.due_date nulls first, f.created_at`,
  ]);

  return (
    <>
      <PageHeader title="Frais scolaires" subtitle={`Année scolaire ${school.academic_year}. Chaque frais est en dollars ou en francs congolais, sans conversion automatique.`} />
      <Card title="Nouveau frais" className="mb-4">
        <ActionForm action={createFee} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
          <FeeFields classes={classes} />
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
            <input type="checkbox" name="monthly" className="h-5 w-5" />
            Pour des frais mensuels : créer automatiquement une échéance par mois, de septembre à juin (le 10 du mois)
          </label>
          <div className="sm:col-span-3"><SubmitButton>Créer le frais</SubmitButton></div>
        </ActionForm>
      </Card>
      <Card className="p-0 sm:p-0">
        <Table head={["Frais", "Montant", "Concerne", "Date limite", "Encaissé", ""]} empty="Aucun frais défini. Créez vos frais d'inscription, minerval, etc.">
          {fees.map((f) => (
            <tr key={f.id} className="align-top">
              <Td>
                <div className="font-semibold">{f.name}</div>
                <div className="text-xs text-gray-500">{FEE_CATEGORIES[f.category as keyof typeof FEE_CATEGORIES]}</div>
              </Td>
              <Td className="font-semibold">{formatMoney(f.amount_cents, f.currency)}</Td>
              <Td>{f.class_name ? classLabel({ name: f.class_name, section: f.class_section }) : "Toutes les classes"}</Td>
              <Td>{formatDate(f.due_date)}</Td>
              <Td className="text-green-700">{formatMoney(f.collected, f.currency)}<div className="text-xs text-gray-500">{f.payers} élève(s)</div></Td>
              <Td>
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-brand-700">Modifier</summary>
                  <div className="mt-2 w-72 whitespace-normal">
                    <ActionForm action={updateFee} className="space-y-3">
                      <input type="hidden" name="id" value={f.id} />
                      <FeeFields classes={classes} d={f} />
                      <SubmitButton>Enregistrer</SubmitButton>
                    </ActionForm>
                    <div className="mt-3">
                      <ConfirmActionButton action={removeFee} fields={{ id: f.id }} label={f.payers > 0 ? "Archiver" : "Supprimer"} confirmMessage={`Retirer le frais « ${f.name} » ?`} />
                    </div>
                  </div>
                </details>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
