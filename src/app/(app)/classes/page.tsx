import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ActionForm, ConfirmActionButton, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { deleteClass, saveClass } from "./actions";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const { school } = await requireSchoolUser(["director"]);
  const classes = await sql<{ id: string; name: string; section: string | null; students: number }[]>`
    select c.id, c.name, c.section, count(s.id) filter (where s.status = 'active')::int as students
    from classes c left join students s on s.class_id = c.id
    where c.school_id = ${school.id} and c.academic_year = ${school.academic_year}
    group by c.id order by c.name`;

  return (
    <>
      <PageHeader title="Classes" subtitle={`Année scolaire ${school.academic_year} · ${classes.length} classe(s)`} />
      <Card title="Nouvelle classe" className="mb-4">
        <ActionForm action={saveClass} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Nom de la classe *"><Input name="name" required placeholder="1re secondaire A" /></Field>
          <Field label="Section ou option"><Input name="section" placeholder="Scientifique, Commerciale…" /></Field>
          <SubmitButton>Ajouter</SubmitButton>
        </ActionForm>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <Card key={c.id}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-gray-900">{c.name}</div>
                <div className="text-xs text-muted">{c.section ?? "Sans section"}</div>
              </div>
              <Link href={`/eleves?classe=${c.id}`} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                {c.students} élève{c.students > 1 ? "s" : ""}
              </Link>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-brand-700">Modifier</summary>
              <ActionForm action={saveClass} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={c.id} />
                <Field label="Nom"><Input name="name" defaultValue={c.name} required /></Field>
                <Field label="Section ou option"><Input name="section" defaultValue={c.section ?? ""} /></Field>
                <SubmitButton>Enregistrer</SubmitButton>
              </ActionForm>
              {c.students === 0 && (
                <div className="mt-3">
                  <ConfirmActionButton action={deleteClass} fields={{ id: c.id }} label="Supprimer la classe" confirmMessage={`Supprimer la classe « ${c.name} » ?`} />
                </div>
              )}
            </details>
          </Card>
        ))}
      </div>
      {classes.length === 0 && <p className="text-center text-sm text-muted">Aucune classe. Créez la première ci-dessus, ou importez vos élèves depuis Excel.</p>}
    </>
  );
}
