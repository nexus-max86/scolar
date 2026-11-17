import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { periodLabel, type PeriodCode } from "@/lib/bulletin";
import { Badge, Card, LinkButton, PageHeader, Table, Td } from "@/components/ui";

export const metadata = { title: "Bulletins" };

export default async function BulletinsPage() {
  const { school } = await requireSchoolUser();
  const classes = await sql<{ id: string; name: string; section: string | null; students: number; subjects: number; grades: number; bulletin_period: PeriodCode | null }[]>`
    select c.id, c.name, c.section, c.bulletin_period,
           (select count(*) from students s where s.class_id = c.id and s.status = 'active')::int as students,
           (select count(*) from subjects sb where sb.class_id = c.id)::int as subjects,
           (select count(*) from grades g join subjects sb on sb.id = g.subject_id where sb.class_id = c.id)::int as grades
    from classes c
    where c.school_id = ${school.id} and c.academic_year = ${school.academic_year}
    order by c.name`;

  return (
    <>
      <PageHeader
        title="Bulletins"
        subtitle="Un modèle unique au format habituel en RDC : deux semestres, deux périodes et un examen chacun. Seuls le nom et le logo de l'école changent."
      />
      <Card>
        <Table head={["Classe", "Élèves", "Cours", "Notes saisies", "Parents", ""]} empty={<>Aucune classe pour cette année. <Link href="/classes" className="text-brand-600 underline">Créer les classes</Link></>}>
          {classes.map((c) => (
            <tr key={c.id}>
              <Td className="font-medium">
                <Link href={`/bulletins/${c.id}`} className="text-brand-700 hover:underline">{c.name}{c.section ? ` (${c.section})` : ""}</Link>
              </Td>
              <Td className="tabular-nums">{c.students}</Td>
              <Td>{c.subjects ? <span className="tabular-nums">{c.subjects}</span> : <Badge color="orange">À définir</Badge>}</Td>
              <Td className="tabular-nums">{c.grades}</Td>
              <Td>{c.bulletin_period ? <Badge color="green">Publié jusqu&apos;à : {periodLabel(c.bulletin_period)}</Badge> : <Badge>Non publié</Badge>}</Td>
              <Td><LinkButton href={`/bulletins/${c.id}`} variant="secondary">Ouvrir</LinkButton></Td>
            </tr>
          ))}
        </Table>
      </Card>
      <p className="mt-4 text-sm text-muted">
        Étapes : 1. définir les cours de la classe et leur maximum · 2. saisir les points de chaque période · 3. imprimer ou publier les bulletins aux parents.
      </p>
    </>
  );
}
