"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { TourStep } from "@/lib/demo";
import { cx } from "./ui";

/**
 * Bandeau de l'école de démonstration : rappelle que tout est fictif et guide la visite écran par écran.
 * Sert aussi de fil conducteur pour présenter Scolar à une école (projecteur, tablette).
 */
export function DemoTour({ steps, leaveAction }: { steps: TourStep[]; leaveAction: (fd: FormData) => Promise<void> }) {
  const pathname = usePathname();
  const index = steps.findIndex((s) => pathname === s.match || pathname.startsWith(s.match));
  const step = index >= 0 ? steps[index] : null;
  const prev = index > 0 ? steps[index - 1] : null;
  const next = index >= 0 ? steps[index + 1] : steps[0];

  return (
    <div className="no-print border-b border-brand-100 bg-brand-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-brand-700">
            <span>École de démonstration</span>
            {step && <span className="tabular-nums text-muted">· Étape {index + 1} sur {steps.length}</span>}
          </div>
          <div className="mt-0.5 text-sm text-ink">
            {step ? (
              <><strong>{step.title}.</strong> {step.text}</>
            ) : (
              <>Tout est fictif et remis à zéro chaque nuit. Explorez librement ou suivez la visite guidée.</>
            )}
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {steps.map((s, i) => (
              <span key={s.match} className={cx("h-1 w-6 rounded-full", i <= index ? "bg-brand-600" : "bg-brand-100")} />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {prev && (
            <Link href={prev.href} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-brand-700 hover:bg-brand-100">
              <ArrowLeft className="h-4 w-4" /> Précédent
            </Link>
          )}
          {next ? (
            <Link href={next.href} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
              {index < 0 ? "Commencer la visite" : `Suivant : ${next.title}`} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          <form action={leaveAction}>
            <input type="hidden" name="to" value="inscription" />
            <button className="inline-flex min-h-10 items-center rounded-lg border border-brand-200 bg-white px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">
              Créer mon école
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
