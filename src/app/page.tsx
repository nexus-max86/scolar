import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, Check, LayoutDashboard, MessageCircle, Smartphone } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LinkButton, Wordmark, buttonClass } from "@/components/ui";
import { whatsAppLink } from "@/lib/phone";

const steps = [
  ["Créez vos classes et vos frais", "Minerval, inscription, mensualités, examens : en dollars ou en francs congolais, par classe ou pour toute l'école."],
  ["Importez vos élèves", "Depuis le fichier Excel que vous avez déjà, ou un par un au guichet."],
  ["Encaissez", "Le caissier choisit l'élève et le frais, le solde se calcule tout seul et le reçu part au parent."],
];

const people = [
  { icon: LayoutDashboard, who: "Le directeur", text: "Voit chaque soir ce qui est rentré, qui est en retard et combien il reste à percevoir. Fixe les frais, les réductions et les exemptions." },
  { icon: Banknote, who: "Le caissier", text: "Trouve l'élève en trois lettres, encaisse en espèces ou Mobile Money et remet un reçu numéroté. Il ne peut ni modifier ni supprimer un paiement." },
  { icon: Smartphone, who: "Le parent", text: "Reçoit le reçu sur WhatsApp et suit le solde de ses enfants depuis son téléphone, sans compte ni mot de passe." },
];

const faq = [
  ["Faut-il un ordinateur ?", "Non. Scolar fonctionne sur un téléphone Android, une tablette ou un ordinateur, dans le navigateur. Rien à installer."],
  ["Et quand Internet coupe ?", "Les pages sont légères et marchent avec peu de réseau. Si la connexion tombe, un bandeau prévient avant d'enregistrer."],
  ["Dollars ou francs congolais ?", "Les deux. Chaque frais a sa devise, et les totaux en USD et en CDF restent séparés, sans conversion cachée."],
  ["Les parents doivent-ils créer un compte ?", "Non. Chaque élève a un lien personnel que l'école envoie au parent par WhatsApp. L'école peut le changer à tout moment."],
  ["Nos données sont-elles protégées ?", "Chaque école ne voit que ses propres données. Les paiements ne sont jamais effacés : une annulation garde la trace de qui, quand et pourquoi."],
  ["Combien de temps pour démarrer ?", "Une matinée : vous créez les classes et les frais, vous importez la liste des élèves depuis Excel, et le caissier peut encaisser."],
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
  const phone = process.env.CONTACT_WHATSAPP;
  const email = process.env.CONTACT_EMAIL;
  const contactHref = phone
    ? whatsAppLink(phone, "Bonjour, je souhaite une présentation de Scolar pour mon école.")
    : email ? `mailto:${email}?subject=Présentation de Scolar` : "/demo";

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-1 text-sm sm:gap-4">
            <a href="#fonctionnement" className="hidden px-2 text-muted hover:text-ink sm:inline">Comment ça marche</a>
            <a href="#tarifs" className="hidden px-2 text-muted hover:text-ink sm:inline">Tarifs</a>
            <Link href="/connexion" className="px-2 font-medium text-ink hover:text-brand-600">Se connecter</Link>
            <LinkButton href="/demo" className="hidden sm:inline-flex">Essayer la démo</LinkButton>
          </nav>
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
              Scolar remplace le cahier de caisse et les carnets de reçus : chaque paiement est enregistré, chaque
              élève a son solde, et les parents reçoivent leurs reçus sur WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/demo" className="h-12 px-5 text-[15px]">Essayer la démo</LinkButton>
              <LinkButton href="/inscription" variant="secondary" className="h-12 px-5 text-[15px]">Créer mon école</LinkButton>
            </div>
            <p className="mt-3 text-sm text-muted">Démo sans inscription. 30 jours gratuits pour votre école, sans engagement.</p>
          </div>
          <ReceiptPreview />
        </section>

        <section className="border-y border-line bg-canvas">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 className="text-xl font-semibold tracking-tight">Une seule application pour toute l&apos;école</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {people.map((p) => (
                <div key={p.who}>
                  <p.icon className="h-6 w-6 text-brand-600" aria-hidden />
                  <h3 className="mt-3 font-semibold">{p.who}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">À quoi ça ressemble</h2>
          <p className="mt-2 max-w-2xl text-[15px] text-muted">Les vrais écrans de Scolar, avec l&apos;école de démonstration.</p>
          <figure className="mt-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/vitrine/tableau-de-bord.webp" alt="Tableau de bord du directeur : encaissé du jour, reste à percevoir, élèves en retard" width={1280} height={800} className="w-full rounded-xl border border-line" />
            <figcaption className="mt-2 text-sm text-muted">Le tableau de bord du directeur.</figcaption>
          </figure>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-8 lg:grid-cols-[300px_300px] lg:justify-center">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vitrine/encaisser.webp" alt="Encaissement sur téléphone" width={390} height={600} loading="lazy" className="w-full rounded-xl border border-line" />
              <figcaption className="mt-2 text-sm text-muted">Encaisser au guichet, sur téléphone.</figcaption>
            </figure>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vitrine/parent.webp" alt="Espace parent sur téléphone" width={390} height={600} loading="lazy" className="w-full rounded-xl border border-line" />
              <figcaption className="mt-2 text-sm text-muted">Ce que voit le parent.</figcaption>
            </figure>
          </div>
          <div className="mt-8">
            <LinkButton href="/demo" variant="secondary">Tout essayer dans la démo</LinkButton>
          </div>
        </section>

        <section id="fonctionnement" className="border-y border-line bg-canvas">
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
        </section>

        <section id="tarifs" className="border-y border-line bg-canvas">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Tarifs</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                30 jours gratuits, avec toutes les fonctions. Ensuite, un abonnement selon le nombre d&apos;élèves de
                l&apos;école. Nous venons présenter Scolar à votre équipe et vous aidons à importer vos élèves.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3 rounded-xl border border-line bg-white p-6">
              <div className="font-semibold">Demandez une présentation dans votre école</div>
              <div className="text-sm text-muted">Nous vous montrons Scolar avec vos propres frais et répondons aux questions du caissier.</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={contactHref} target={phone ? "_blank" : undefined} rel="noopener" className={buttonClass("success", "gap-1.5")}>
                  {phone && <MessageCircle className="h-4 w-4" />} {phone ? "Écrire sur WhatsApp" : email ? "Nous écrire" : "Voir la démo"}
                </a>
                <LinkButton href="/inscription" variant="secondary">Essai gratuit</LinkButton>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">Questions fréquentes</h2>
          <dl className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {faq.map(([q, a]) => (
              <div key={q}>
                <dt className="font-semibold">{q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{a}</dd>
              </div>
            ))}
          </dl>
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
          <span>© {new Date().getFullYear()} Scolar · Kinshasa</span>
          <div className="flex gap-4">
            <Link href="/demo" className="hover:text-ink">Démo</Link>
            <Link href="/connexion" className="hover:text-ink">Espace école</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
