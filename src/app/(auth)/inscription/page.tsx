import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input } from "@/components/ui";
import { registerSchool } from "../actions";

export const metadata = { title: "Inscrire mon école" };

function defaultAcademicYear() {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export default function RegisterPage() {
  return (
    <Card className="w-full max-w-2xl">
      <h1 className="text-lg font-bold">Inscrire mon école</h1>
      <p className="mb-4 text-sm text-gray-600">30 jours d&apos;essai gratuit, sans engagement.</p>
      <ActionForm action={registerSchool}>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-brand-700">L&apos;école</legend>
          <Field label="Nom de l'école *" className="sm:col-span-2">
            <Input name="school_name" required placeholder="Complexe scolaire La Victoire" />
          </Field>
          <Field label="Adresse">
            <Input name="address" placeholder="Av. de la Paix n°12, Lingwala" />
          </Field>
          <Field label="Ville *">
            <Input name="city" required placeholder="Kinshasa" />
          </Field>
          <Field label="Téléphone *">
            <Input name="phone" type="tel" required placeholder="0812 345 678" />
          </Field>
          <Field label="E-mail de l'école">
            <Input name="school_email" type="email" />
          </Field>
          <Field label="Année scolaire en cours *" hint="Format : 2026-2027">
            <Input name="academic_year" required defaultValue={defaultAcademicYear()} pattern="\d{4}-\d{4}" />
          </Field>
          <Field label="Logo (facultatif)" hint="PNG ou JPEG, 500 Ko maximum">
            <Input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
          </Field>
        </fieldset>
        <fieldset className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-brand-700">Le directeur (compte principal)</legend>
          <Field label="Nom du directeur *">
            <Input name="director_name" required autoComplete="name" />
          </Field>
          <Field label="E-mail de connexion *">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Mot de passe *" hint="8 caractères minimum">
            <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirmer le mot de passe *">
            <Input name="password_confirm" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
        </fieldset>
        <SubmitButton className="w-full" pendingText="Création de l'espace…">
          Créer l&apos;espace de mon école
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-gray-600">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold text-brand-700">
          Se connecter
        </Link>
      </p>
    </Card>
  );
}
