import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LinkButton } from "@/components/ui";

const points = [
  ["Reçus numérotés", "Chaque paiement produit un reçu unique, imprimable ou en PDF, envoyé au parent par WhatsApp."],
  ["Impayés en un coup d'œil", "Le solde de chaque élève est calculé automatiquement, en dollars ou en francs congolais."],
  ["Caisse du jour", "Le directeur voit ce qui a été encaissé, par qui et par quel moyen : espèces, M-Pesa, Airtel, Orange…"],
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "super_admin" ? "/admin" : "/tableau-de-bord");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">ÉcoleFacile RDC</p>
      <h1 className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
        La caisse et les élèves de votre école, enfin sous contrôle.
      </h1>
      <p className="mt-4 max-w-2xl text-gray-600">
        Une plateforme simple, pensée pour les écoles privées de la RDC : elle fonctionne sur un téléphone Android,
        même avec une connexion faible.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton href="/inscription">Essai gratuit 30 jours</LinkButton>
        <LinkButton href="/connexion" variant="secondary">
          Se connecter
        </LinkButton>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {points.map(([title, text]) => (
          <div key={title} className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">{text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
