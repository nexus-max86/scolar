import Link from "next/link";
import { Check } from "lucide-react";
import { cx } from "./ui";

export type SetupStep = { done: boolean; label: string; detail: string; href: string; cta: string };

/** Guide de démarrage d'une nouvelle école : disparaît quand tout est fait. */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  return (
    <section className="mb-6 rounded-[var(--radius-card)] border border-line bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[15px] font-semibold">Mettre l&apos;école en route</h2>
          <p className="text-sm text-muted">{done} étape{done > 1 ? "s" : ""} sur {steps.length}. Comptez une vingtaine de minutes.</p>
        </div>
        <div className="hidden h-1.5 w-32 rounded-full bg-gray-100 sm:block" aria-hidden>
          <div className="h-1.5 rounded-full bg-green-600" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol>
        {steps.map((s, i) => {
          const current = s === next;
          return (
            <li key={s.label} className={cx("flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:px-5", current && "bg-brand-50/50")}>
              <span
                className={cx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  s.done ? "bg-green-600 text-white" : current ? "bg-brand-600 text-white" : "border border-line text-muted",
                )}
              >
                {s.done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cx("text-sm font-medium", s.done && "text-muted line-through")}>{s.label}</div>
                {current && <div className="text-xs text-muted">{s.detail}</div>}
              </div>
              {current && (
                <Link href={s.href} className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
                  {s.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
