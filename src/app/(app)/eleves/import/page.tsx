import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { importStudents } from "../actions";

export const metadata = { title: "Importer des élèves" };

const HEADINGS: [string, string][] = [
  ["Nom *", "Nom, Noms, Nom de l'élève"],
  ["Postnom", "Postnom, Post-nom"],
  ["Prénom", "Prénom, Prénoms"],
  ["Sexe", "Sexe, Genre (M ou F)"],
  ["Date de naissance", "Date de naissance, Né(e) le (14/03/2014)"],
  ["Classe", "Classe, Niveau"],
  ["Nom du parent", "Nom du parent, Parent, Tuteur"],
  ["Téléphone du parent", "Téléphone du parent, Téléphone, Tél, Contact"],
  ["Matricule", "Matricule, N° matricule (vide = automatique)"],
];

export default async function ImportPage() {
  await requireSchoolUser();
  return (
    <>
      <PageHeader
        title="Importer des élèves depuis Excel"
        subtitle="Envoyez le fichier que l'école utilise déjà : pas besoin de tout ressaisir."
        actions={<LinkButton href="/eleves" variant="secondary">Retour aux élèves</LinkButton>}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Pas à pas" className="lg:col-span-3">
          <ol className="space-y-4 text-sm text-gray-700">
            <li className="flex gap-3">
              <Step n={1} />
              <div>
                <strong className="text-ink">Ouvrez votre fichier habituel</strong> dans Excel, sur l&apos;ordinateur de l&apos;école.
                Une ligne par élève, la première ligne pour les titres des colonnes. Supprimez les lignes de titre ou de total au-dessus et en dessous de la liste.
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={2} />
              <div>
                <strong className="text-ink">Vérifiez les titres de colonnes.</strong> Scolar reconnaît ceux-ci, dans n&apos;importe quel ordre :
                <div className="mt-2 overflow-hidden rounded-lg border border-line">
                  <table className="min-w-full text-xs">
                    <tbody className="divide-y divide-line">
                      {HEADINGS.map(([k, v]) => (
                        <tr key={k}><td className="whitespace-nowrap bg-canvas px-2 py-1.5 font-medium text-ink">{k}</td><td className="px-2 py-1.5 text-muted">{v}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-xs text-muted">Titre non reconnu ? Renommez-le, ou copiez vos colonnes dans le modèle Scolar.</p>
                <a href="/api/export/modele-eleves" className={buttonClass("secondary", "mt-2")}>Télécharger le modèle Excel</a>
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={3} />
              <div>
                <strong className="text-ink">Enregistrez au format .xlsx.</strong> Si votre fichier est en .xls ou .csv : <em>Fichier → Enregistrer sous → Classeur Excel (*.xlsx)</em>.
                Sur Google Sheets : <em>Fichier → Télécharger → Microsoft Excel (.xlsx)</em>. Fermez ensuite le fichier.
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={4} />
              <div>
                <strong className="text-ink">Envoyez-le</strong> avec le formulaire. Les lignes correctes sont importées ; les autres apparaissent dans un tableau avec la correction à faire.
                Corrigez puis renvoyez le même fichier : les élèves déjà importés sont reconnus et ne sont pas créés deux fois.
              </div>
            </li>
          </ol>
          <p className="mt-4 text-sm"><Link href="/aide/excel" target="_blank" className="font-medium text-brand-600 hover:underline">Guide complet « Importer vos fichiers Excel » →</Link></p>
        </Card>
        <Card title="Envoyer le fichier" className="lg:col-span-2 lg:self-start">
          <ActionForm action={importStudents} resetOnSuccess>
            <Field label="Fichier Excel (.xlsx)" hint="3 Mo maximum, 2 000 élèves par envoi">
              <Input name="file" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
            </Field>
            <SubmitButton pendingText="Import en cours…">Importer les élèves</SubmitButton>
          </ActionForm>
          <p className="mt-3 text-xs text-muted">Les classes qui n&apos;existent pas encore sont créées automatiquement.</p>
        </Card>
      </div>
    </>
  );
}

function Step({ n }: { n: number }) {
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{n}</span>;
}
