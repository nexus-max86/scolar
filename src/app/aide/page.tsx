import Link from "next/link";
import { ArrowRight, Banknote, LayoutDashboard, Smartphone } from "lucide-react";
import { GUIDES } from "@/lib/guides";
import { GuideShell } from "@/components/guide-ui";

export const metadata = {
  title: "Guides d'utilisation",
  description: "Guides illustrés de Scolar pour les directeurs, les caissiers et les parents.",
};

const ICONS = { directeur: LayoutDashboard, caissier: Banknote, parent: Smartphone };

export default function HelpIndex() {
  return (
    <GuideShell>
      <p className="text-sm font-medium text-brand-600">Aide</p>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">Guides d&apos;utilisation</h1>
      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted">
        Chaque guide explique Scolar écran par écran, avec des images. Choisissez celui qui correspond à votre rôle.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {GUIDES.map((g) => {
          const Icon = ICONS[g.slug];
          return (
            <Link key={g.slug} href={`/aide/${g.slug}`} className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 hover:border-brand-200">
              <Icon className="h-6 w-6 text-brand-600" aria-hidden />
              <h2 className="mt-3 font-semibold text-ink">{g.title}</h2>
              <p className="text-xs text-muted">{g.audience}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{g.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                Lire le guide <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
      <p className="mt-8 text-sm text-muted">
        Pour essayer sans risque, ouvrez la <Link href="/demo" className="font-medium text-brand-700 hover:underline">démo</Link> : une école fictive remise à zéro chaque nuit.
      </p>
    </GuideShell>
  );
}
