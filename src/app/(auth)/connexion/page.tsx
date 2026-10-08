import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input } from "@/components/ui";
import { login } from "../actions";

export const metadata = { title: "Connexion" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "super_admin" ? "/admin" : "/tableau-de-bord");

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-lg font-semibold">Connexion à votre espace</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Directeur ou caissier : utilisez l&apos;e-mail que l&apos;école vous a donné.</p>
      <ActionForm action={login}>
        <Field label="Adresse e-mail">
          <Input name="email" type="email" autoComplete="email" required inputMode="email" />
        </Field>
        <Field label="Mot de passe">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Connexion…">
          Se connecter
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-muted">
        Nouvelle école ?{" "}
        <Link href="/inscription" className="font-medium text-brand-600">
          Inscrire mon école
        </Link>
      </p>
    </Card>
  );
}
