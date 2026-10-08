import Link from "next/link";
import type { ReactNode } from "react";

/** Liste en lignes pour téléphone, à la place d'un tableau large. */
export function MobileList({ children, empty }: { children: ReactNode; empty?: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <ul className="divide-y divide-line sm:hidden">
      {hasRows ? children : <li className="px-4 py-10 text-center text-sm text-muted">{empty ?? "Aucune donnée."}</li>}
    </ul>
  );
}

export function MobileRow({ href, title, subtitle, right, rightSub }: { href: string; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; rightSub?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 px-4 py-3 active:bg-gray-50">
        <div className="min-w-0">
          <div className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{title}</div>
          {subtitle && <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>}
        </div>
        {(right || rightSub) && (
          <div className="shrink-0 text-right">
            {right && <div className="text-sm font-medium tabular-nums">{right}</div>}
            {rightSub && <div className="mt-0.5 text-xs">{rightSub}</div>}
          </div>
        )}
      </Link>
    </li>
  );
}
