import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";
import { classOptions } from "@/lib/students";
import { studentFullName } from "@/lib/labels";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader, LinkButton } from "@/components/ui";
import { StudentFields } from "../../student-form";
import { updateStudent } from "../../actions";

export const metadata = { title: "Modifier un élève" };

export default async function EditStudentPage(props: PageProps<"/eleves/[id]/modifier">) {
  const { id } = await props.params;
  const { school } = await requireSchoolUser();
  if (!isUuid(id)) notFound();
  const [student] = await sql`select * from students where id = ${id} and school_id = ${school.id}`;
  if (!student) notFound();
  const classes = await classOptions(school.id, school.academic_year);
  return (
    <>
      <PageHeader title="Modifier l'élève" subtitle={studentFullName(student as never)} />
      <Card>
        <ActionForm action={updateStudent}>
          <StudentFields classes={classes} defaults={student as never} edit />
          <div className="flex gap-2 border-t border-gray-100 pt-4">
            <SubmitButton>Enregistrer les modifications</SubmitButton>
            <LinkButton href={`/eleves/${id}`} variant="secondary">
              Annuler
            </LinkButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
