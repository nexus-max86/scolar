import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, LayoutDashboard, Smartphone } from "lucide-react";
import { Alert, Wordmark, buttonClass } from "@/components/ui";
import { enterDemo } from "./actions";

export const metadata: Metadata = {
  title: "Essayer la démo",
  description: "Entrez dans une école fictive et utilisez Scolar comme un directeur, un caissier ou un parent.",
};

const roles = [
  {
    role: "director",
    icon: LayoutDashboard,
    title: "Directeur",
    text: "Le tableau de bord, les impayés, les frais, les réductions et la caisse du jour.",
    cta: "Entrer comme directeur",
  },
  {
    role: "cashier",
    icon: Banknote,
    title: "Caissier",
    text: "Chercher un élève, encaisser, imprimer ou envoyer le reçu par WhatsApp.",
    cta: "Entrer comme caissier",
  },
  {
    role: "parent",
    icon: Smartphone,
    title: "Parent",
    text: "Ce que le parent voit sur son téléphone : le solde, le prochain paiement et ses reçus.",
    cta: "Voir l'espace parent",
  },
];

export default async function DemoPage(props: PageProps<"/demo">) {
  const sp = await props.searchParams;
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Accueil"><Wordmark /></Link>
          <Link href="/inscription" className="text-sm font-medium text-brand-700 hover:underline">Créer mon école</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-medium text-brand-600">Démonstration</p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">
          Essayez Scolar dans une école fictive
        </h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted">
          Le Complexe Scolaire La Victoire compte 122 élèves, des paiements en dollars et en francs, des impayés et du
          transport. Encaissez, annulez, explorez : tout est remis à zéro chaque nuit.
        </p>
        {sp.indisponible && <div className="mt-6"><Alert kind="warning">La démo n&apos;est pas disponible pour le moment.</Alert></div>}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {roles.map((r) => (
            <form key={r.role} action={enterDemo} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-5">
              <input type="hidden" name="role" value={r.role} />
              <r.icon className="h-6 w-6 text-brand-600" aria-hidden />
              <h2 className="mt-3 font-semibold text-ink">{r.title}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{r.text}</p>
              <button className={buttonClass("primary", "mt-5 w-full")}>
                {r.cta}
              </button>
            </form>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Une visite guidée vous accompagne écran par écran. Pour utiliser Scolar avec vos vrais élèves,{" "}
          <Link href="/inscription" className="font-medium text-brand-700 hover:underline">créez l&apos;espace de votre école</Link>.
        </p>
      </main>
    </div>
  );
}
