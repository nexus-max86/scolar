import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LinkButton, Wordmark } from "@/components/ui";

const steps = [
  ["Créez vos classes et vos frais", "Minerval, inscription, mensualités, examens : en dollars ou en francs congolais, par classe ou pour toute l'école."],
  ["Importez vos élèves", "Depuis le fichier Excel que vous avez déjà, ou un par un au guichet."],
  ["Encaissez", "Le caissier choisit l'élève et le frais, le solde se calcule tout seul et le reçu part au parent."],
];

const facts = [
  "Montants en USD et en CDF, jamais mélangés",
  "Espèces, M-Pesa, Airtel Money, Orange Money, virement",
  "Reçu PDF numéroté, imprimable, envoyé par WhatsApp",
  "Fonctionne sur un téléphone Android, même avec peu de réseau",
  "Le caissier ne peut ni supprimer ni modifier un paiement",
  "Chaque école ne voit que ses propres données",
];

function ReceiptPreview() {
  return (
    <div className="mx-auto w-full max-w-sm rotate-[0.6deg] rounded-xl border border-line bg-white p-5 text-sm shadow-[0_1px_2px_rgba(16,24,40,.04),0_12px_32px_-12px_rgba(16,24,40,.18)]">
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-sm font-semibold text-white">L</span>
        <div>
          <div className="font-semibold">C.S. La Victoire</div>
          <div className="text-xs text-muted">Lingwala, Kinshasa</div>
        </div>
      </div>
      <div className="flex items-center justify-between py-3">
        <span className="text-xs font-medium text-muted">Reçu de paiement</span>
        <span className="font-mono text-xs">LV-2026-000214</span>
      </div>
      <dl className="space-y-1.5">
        {[["Élève", "MUKENDI KALALA Grâce"], ["Classe", "6e primaire"], ["Frais", "Minerval 1er trimestre"], ["Moyen", "M-Pesa"]].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-3 flex items-baseline justify-between rounded-lg bg-green-50 px-3 py-2.5">
        <span className="text-xs font-medium text-green-800">Montant payé</span>
        <span className="text-xl font-semibold tabular-nums text-green-800">40,00 $</span>
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="text-muted">Reste à payer</span>
        <span className="font-semibold text-red-700">20,00 $</span>
      </div>
    </div>
  );
}

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "super_admin" ? "/admin" : "/tableau-de-bord");

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <Link href="/connexion" className="text-sm font-medium text-ink hover:text-brand-600">Se connecter</Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-5xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="mb-3 text-sm font-medium text-brand-600">Pour les écoles privées de la RDC</p>
            <h1 className="text-[34px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[44px]">
              Sachez chaque soir ce qui est rentré dans la caisse.
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted">
              ÉcoleFacile remplace le cahier de caisse et les carnets de reçus : chaque paiement est enregistré, chaque
              élève a son solde, et vous voyez qui doit encore combien.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/inscription" className="h-12 px-5 text-[15px]">Essayer 30 jours gratuitement</LinkButton>
              <span className="text-sm text-muted">Sans carte, sans engagement.</span>
            </div>
          </div>
          <ReceiptPreview />
        </section>

        <section className="border-y border-line bg-canvas">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 className="text-xl font-semibold tracking-tight">Prêt en une matinée</h2>
            <ol className="mt-8 grid gap-8 sm:grid-cols-3">
              {steps.map(([title, text], i) => (
                <li key={title}>
                  <div className="text-sm font-medium tabular-nums text-brand-600">0{i + 1}</div>
                  <h3 className="mt-2 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">Fait pour la façon dont les écoles paient ici</h2>
          <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {facts.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[15px]">
                <Check size={18} className="mt-0.5 shrink-0 text-green-700" aria-hidden /> {f}
              </li>
            ))}
          </ul>
          <div className="mt-12 flex flex-col items-start gap-4 rounded-xl border border-line p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">Essayez avec votre école</div>
              <div className="text-sm text-muted">L&apos;espace est créé en deux minutes. Vos données restent les vôtres.</div>
            </div>
            <LinkButton href="/inscription">Créer l&apos;espace de mon école</LinkButton>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} ÉcoleFacile RDC · Kinshasa</span>
          <Link href="/connexion" className="hover:text-ink">Espace école</Link>
        </div>
      </footer>
    </div>
  );
}
