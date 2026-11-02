import { requireSchoolUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { importPayments } from "../actions";

export const metadata = { title: "Reprendre les paiements déjà reçus" };

export default async function ImportPaymentsPage() {
  await requireSchoolUser(["director"]);
  return (
    <>
      <PageHeader
        title="Reprendre les paiements déjà reçus"
        subtitle="Pour une école qui commence Scolar en cours d'année : les paiements notés dans Excel ou dans le cahier deviennent des reçus, et les soldes sont justes dès le premier jour."
        actions={<LinkButton href="/paiements" variant="secondary">Retour aux paiements</LinkButton>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="1. Remplir le modèle">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
            <li>Téléchargez le modèle : il contient déjà vos élèves, une ligne chacun.</li>
            <li>Pour chaque paiement, choisissez le <strong>frais</strong> dans la liste et indiquez le <strong>montant</strong> et la <strong>date</strong> (ex. 15/09/2026).</li>
            <li>Un élève a payé plusieurs fois ? Copiez sa ligne autant de fois que nécessaire.</li>
            <li>Laissez vides les élèves qui n&apos;ont rien payé. Moyen : espèces si la case est vide.</li>
          </ol>
          <p className="mt-3 text-sm text-muted">Vous pouvez aussi coller vos propres colonnes dans le modèle, à condition de garder les en-têtes.</p>
          <a href="/api/export/modele-paiements" className={buttonClass("secondary", "mt-4")}>Télécharger le modèle Excel</a>
        </Card>
        <Card title="2. Envoyer le fichier">
          <p className="mb-3 text-sm text-gray-700">
            Scolar vérifie tout le fichier avant d&apos;importer. Si une ligne pose problème, rien n&apos;est enregistré
            et la liste des lignes à corriger s&apos;affiche ici.
          </p>
          <ActionForm action={importPayments} resetOnSuccess>
            <Field label="Fichier Excel (.xlsx)" hint="5 Mo maximum, 3 000 paiements par import">
              <Input name="file" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
            </Field>
            <SubmitButton pendingText="Vérification et import…">Importer les paiements</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
