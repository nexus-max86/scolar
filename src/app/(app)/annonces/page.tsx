import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { isUuid } from "@/lib/actions";
import { sql } from "@/lib/db";
import { audienceLabel, listAnnouncements } from "@/lib/announcements";
import { classLabel, classOptions } from "@/lib/students";
import { formatDate, studentFullName } from "@/lib/labels";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Badge, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { AudiencePicker } from "./audience-picker";
import { createAnnouncement } from "./actions";

export const metadata = { title: "Annonces" };

export default async function AnnouncementsPage(props: PageProps<"/annonces">) {
  const sp = await props.searchParams;
  const { school } = await requireSchoolUser(["director"]);
  const studentParam = typeof sp.eleve === "string" && isUuid(sp.eleve) ? sp.eleve : null;
  const [rows, classes, studentRows] = await Promise.all([
    listAnnouncements(school.id),
    classOptions(school.id, school.academic_year),
    studentParam
      ? sql<{ id: string; last_name: string; middle_name: string | null; first_name: string | null }[]>`
          select id, last_name, middle_name, first_name from students where id = ${studentParam} and school_id = ${school.id}`
      : Promise.resolve([]),
  ]);
  const student = studentRows[0] ? { id: studentRows[0].id, name: studentFullName(studentRows[0]) } : null;

  return (
    <>
      <PageHeader title="Annonces" subtitle="Informez les parents : réunions, examens, congés, changements d'horaire, événements." />
      {sp.retiree && <div className="mb-4"><Alert kind="success">L&apos;annonce a été retirée de l&apos;espace des parents.</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card title="Nouvelle annonce">
          <ActionForm action={createAnnouncement} className="space-y-4">
            <Field label="Titre *"><Input name="title" required minLength={3} maxLength={120} placeholder="Réunion des parents du 1er trimestre" /></Field>
            <Field label="Message *"><Textarea name="body" required rows={6} maxLength={4000} placeholder="Chers parents, la réunion aura lieu dans la grande salle à 9 h. Votre présence est importante." /></Field>
            <Field label="Date concernée" hint="Facultatif : date de la réunion, de l'examen, du congé…"><Input name="event_date" type="date" /></Field>
            <AudiencePicker classes={classes.map((c) => ({ id: c.id, label: classLabel(c) }))} student={student} />
            <SubmitButton>Publier l&apos;annonce</SubmitButton>
            <p className="text-xs text-muted">L&apos;annonce apparaît aussitôt sur l&apos;espace parent des familles concernées. Vous pourrez ensuite l&apos;envoyer par WhatsApp.</p>
          </ActionForm>
        </Card>
        <Card title="Annonces publiées" className="p-0 sm:p-0">
          {rows.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted sm:px-5">Aucune annonce pour le moment.</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((a) => (
                <li key={a.id}>
                  <Link href={`/annonces/${a.id}`} className="block px-4 py-3 hover:bg-gray-50 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-ink">{a.title}</span>
                      <span className="shrink-0 text-xs text-muted">{formatDate(a.created_at)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge color="blue">{audienceLabel(a)}</Badge>
                      {a.event_date && <span>Le {formatDate(a.event_date)}</span>}
                      <span>Lue : {a.reads} élève{a.reads > 1 ? "s" : ""} sur {a.recipients}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
