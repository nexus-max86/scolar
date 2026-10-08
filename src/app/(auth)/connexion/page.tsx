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
      <h1 className="mb-4 text-lg font-bold">Connexion</h1>
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
      <p className="mt-4 text-center text-sm text-gray-600">
        Nouvelle école ?{" "}
        <Link href="/inscription" className="font-semibold text-brand-700">
          Inscrire mon école
        </Link>
      </p>
    </Card>
  );
}
