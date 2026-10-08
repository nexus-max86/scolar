import { requireSchoolUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { importStudents } from "../actions";

export const metadata = { title: "Importer des élèves" };

export default async function ImportPage() {
  await requireSchoolUser();
  return (
    <>
      <PageHeader title="Importer des élèves depuis Excel" actions={<LinkButton href="/eleves" variant="secondary">Retour aux élèves</LinkButton>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="1. Préparer le fichier">
          <p className="text-sm text-gray-700">
            Téléchargez le modèle et remplissez une ligne par élève. Seule la colonne <strong>Nom</strong> est obligatoire.
            Les classes qui n&apos;existent pas encore seront créées automatiquement. Les dates peuvent être écrites
            comme 14/03/2014.
          </p>
          <a href="/api/export/modele-eleves" className={buttonClass("secondary", "mt-4")}>Télécharger le modèle Excel</a>
        </Card>
        <Card title="2. Envoyer le fichier">
          <ActionForm action={importStudents} resetOnSuccess>
            <Field label="Fichier Excel (.xlsx)" hint="3 Mo maximum, 2 000 élèves par import">
              <Input name="file" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
            </Field>
            <SubmitButton pendingText="Import en cours…">Importer les élèves</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
