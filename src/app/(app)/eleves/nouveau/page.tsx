import { requireSchoolUser } from "@/lib/auth";
import { classOptions } from "@/lib/students";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader, LinkButton } from "@/components/ui";
import { StudentFields } from "../student-form";
import { createStudent } from "../actions";

export const metadata = { title: "Inscrire un élève" };

export default async function NewStudentPage() {
  const { school } = await requireSchoolUser();
  const classes = await classOptions(school.id, school.academic_year);
  return (
    <>
      <PageHeader title="Inscrire un élève" subtitle={`Année scolaire ${school.academic_year}`} />
      <Card>
        <ActionForm action={createStudent}>
          <StudentFields classes={classes} />
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <SubmitButton>Enregistrer l&apos;élève</SubmitButton>
            <SubmitButton name="then" value="payer" variant="success" pendingText="Enregistrement…">
              Enregistrer et encaisser un paiement
            </SubmitButton>
            <LinkButton href="/eleves" variant="secondary">
              Annuler
            </LinkButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
