import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PLANS, SCHOOL_STATUS, formatDate } from "@/lib/labels";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { changeOwnPassword, updateSchool } from "./actions";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const { school } = await requireSchoolUser(["director"]);
  const [s] = await sql<{ name: string; address: string | null; city: string | null; phone: string | null; email: string | null;
    director_name: string | null; academic_year: string; receipt_prefix: string; receipt_footer: string | null; receipt_format: string }[]>`
    select name, address, city, phone, email, director_name, academic_year, receipt_prefix, receipt_footer, receipt_format
    from schools where id = ${school.id}`;

  return (
    <>
      <PageHeader title="Paramètres" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="L'école et les reçus" className="lg:col-span-2">
          <ActionForm action={updateSchool} className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom de l'école *" className="sm:col-span-2"><Input name="name" required defaultValue={s.name} /></Field>
            <Field label="Adresse"><Input name="address" defaultValue={s.address ?? ""} /></Field>
            <Field label="Ville"><Input name="city" defaultValue={s.city ?? ""} /></Field>
            <Field label="Téléphone"><Input name="phone" defaultValue={s.phone ?? ""} /></Field>
            <Field label="E-mail"><Input name="email" type="email" defaultValue={s.email ?? ""} /></Field>
            <Field label="Nom du directeur"><Input name="director_name" defaultValue={s.director_name ?? ""} /></Field>
            <Field label="Année scolaire en cours *" hint="Changer d'année affiche les classes et frais de la nouvelle année">
              <Input name="academic_year" required pattern="\d{4}-\d{4}" defaultValue={s.academic_year} />
            </Field>
            <Field label="Logo" hint="PNG ou JPEG, 500 Ko maximum. Il apparaît sur les reçus.">
              <Input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
            </Field>
            <div className="flex items-end gap-4">
              {school.has_logo && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/logo/${school.id}`} alt="Logo actuel" className="h-14 w-14 rounded border object-contain" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remove_logo" className="h-5 w-5" /> Retirer le logo</label>
                </>
              )}
            </div>
            <Field label="Préfixe des numéros de reçu" hint="Ex. : REC donne REC-2026-000001">
              <Input name="receipt_prefix" required defaultValue={s.receipt_prefix} maxLength={8} />
            </Field>
            <Field label="Format des reçus" hint="Ticket : pour une petite imprimante thermique">
              <Select name="receipt_format" defaultValue={s.receipt_format}>
                <option value="a4">Feuille A4 / A5</option>
                <option value="ticket80">Ticket 80 mm</option>
                <option value="ticket58">Ticket 58 mm</option>
              </Select>
            </Field>
            <Field label="Mention en bas des reçus" className="sm:col-span-2">
              <Textarea name="receipt_footer" defaultValue={s.receipt_footer ?? ""} placeholder="Les frais versés ne sont pas remboursables." maxLength={90} />
            </Field>
            <div className="sm:col-span-2"><SubmitButton>Enregistrer</SubmitButton></div>
          </ActionForm>
        </Card>
        <div className="space-y-4">
          <Card title="Abonnement">
            <div id="abonnement" className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Formule</span><strong>{PLANS[school.subscription_plan]}</strong></div>
              <div className="flex justify-between"><span className="text-muted">Statut</span><strong>{SCHOOL_STATUS[school.status]}</strong></div>
              <div className="flex justify-between"><span className="text-muted">Valable jusqu&apos;au</span><strong>{formatDate(school.subscription_end_date)}</strong></div>
              <p className="pt-2 text-muted">
                Pour renouveler ou changer de formule, payez par Mobile Money et envoyez la référence à l&apos;équipe
                Scolar : l&apos;abonnement est prolongé le jour même.
              </p>
            </div>
          </Card>
          <Card title="Mon mot de passe">
            <ActionForm action={changeOwnPassword} resetOnSuccess>
              <Field label="Mot de passe actuel"><Input name="current" type="password" required autoComplete="current-password" /></Field>
              <Field label="Nouveau mot de passe"><Input name="next" type="password" required minLength={8} autoComplete="new-password" /></Field>
              <SubmitButton variant="secondary">Changer</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
