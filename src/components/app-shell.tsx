"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cx } from "./ui";

export type NavItem = { href: string; label: string; icon: string };

export function AppShell({
  nav,
  schoolName,
  userName,
  roleLabel,
  logoUrl,
  logoutAction,
  children,
}: {
  nav: NavItem[];
  schoolName: string;
  userName: string;
  roleLabel: string;
  logoUrl: string | null;
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-brand-800 px-4 py-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-10 w-10 rounded-md bg-white object-contain p-0.5" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15 text-lg font-bold">
            {schoolName.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{schoolName}</div>
          <div className="text-xs text-brand-100">ÉcoleFacile RDC</div>
        </div>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={cx(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                  active ? "bg-white text-brand-700" : "text-white hover:bg-white/10",
                )}
              >
                <span aria-hidden className="w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-brand-800 p-4 text-sm">
        <div className="font-semibold">{userName}</div>
        <div className="text-xs text-brand-100">{roleLabel}</div>
        <form action={logoutAction} className="mt-3">
          <button className="min-h-11 w-full rounded-lg bg-white/10 px-3 text-left text-sm hover:bg-white/20">
            Se déconnecter
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-full flex-1">
      <aside className="no-print hidden w-64 shrink-0 bg-brand-700 text-white lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button aria-label="Fermer le menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-brand-700 text-white shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-xl"
            aria-label="Ouvrir le menu"
          >
            ☰
          </button>
          <div className="truncate font-semibold text-gray-900">{schoolName}</div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
