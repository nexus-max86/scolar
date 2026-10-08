import { redirect } from "next/navigation";
import { getCurrentSchool, getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { logout } from "../(auth)/actions";

export const metadata = { title: "Compte suspendu" };

export default async function SuspendedPage() {
  const user = await getCurrentUser();
  if (!user?.school_id) redirect("/connexion");
  const school = await getCurrentSchool(user.school_id);
  if (school?.status !== "suspended") redirect("/tableau-de-bord");
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <Card className="max-w-md text-center">
        <h1 className="text-lg font-bold text-red-700">Compte de l&apos;école suspendu</h1>
        <p className="mt-2 text-sm text-gray-600">
          L&apos;accès de {school.name} à ÉcoleFacile est suspendu. Vos données sont conservées. Contactez l&apos;équipe
          ÉcoleFacile pour réactiver le compte.
        </p>
        <form action={logout} className="mt-4">
          <button className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold">Se déconnecter</button>
        </form>
      </Card>
    </main>
  );
}
