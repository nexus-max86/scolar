"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Banknote, CircleAlert, Coins, House, LayoutDashboard, LogOut, Menu, ReceiptText, School, Search, Settings, UserCog,
  Users, Wallet, X, type LucideIcon,
  CircleHelp,
} from "lucide-react";
import { LogoMark, cx } from "./ui";

type NavItem = { href: string; label: string; icon: LucideIcon };

const DAILY: NavItem[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/paiements/nouveau", label: "Encaisser", icon: Banknote },
  { href: "/eleves", label: "Élèves", icon: Users },
  { href: "/paiements", label: "Paiements", icon: ReceiptText },
  { href: "/impayes", label: "Impayés", icon: CircleAlert },
  { href: "/caisse", label: "Caisse du jour", icon: Wallet },
];
const SETUP: NavItem[] = [
  { href: "/classes", label: "Classes", icon: School },
  { href: "/frais", label: "Frais scolaires", icon: Coins },
  { href: "/utilisateurs", label: "Utilisateurs", icon: UserCog },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/paiements") return pathname === "/paiements" || pathname.startsWith("/recus/");
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex min-h-10 items-center gap-3 rounded-md px-2.5 text-sm",
        active ? "bg-brand-50 font-medium text-brand-700" : "text-gray-700 hover:bg-gray-100 hover:text-ink",
      )}
    >
      <Icon size={18} strokeWidth={1.75} className={active ? "text-brand-600" : "text-gray-400"} aria-hidden />
      {item.label}
    </Link>
  );
}

function StudentSearch({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  return (
    <form
      role="search"
      className={cx("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q")?.toString().trim();
        if (q) router.push(`/eleves?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
      <input
        name="q"
        type="search"
        autoFocus={autoFocus}
        placeholder="Rechercher un élève (nom ou matricule)"
        aria-label="Rechercher un élève"
        className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-base placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 sm:text-sm"
      />
    </form>
  );
}

export function AppShell({
  isDirector,
  schoolName,
  userName,
  roleLabel,
  logoUrl,
  logoutAction,
  children,
}: {
  isDirector: boolean;
  schoolName: string;
  userName: string;
  roleLabel: string;
  logoUrl: string | null;
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [searching, setSearching] = useState(false);
  const close = () => setDrawer(false);

  const schoolBadge = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-md border border-line bg-white object-contain p-0.5" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm font-semibold text-white">
      {schoolName.charAt(0).toUpperCase()}
    </span>
  );

  const navigation = (onClick?: () => void) => (
    <>
      <div className="space-y-0.5">
        {DAILY.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onClick={onClick} />)}
      </div>
      {isDirector && (
        <>
          <div className="mb-1 mt-6 px-2.5 text-xs font-medium text-muted">Gestion de l&apos;école</div>
          <div className="space-y-0.5">
            {SETUP.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onClick={onClick} />)}
          </div>
        </>
      )}
    </>
  );

  const account = (
    <div className="border-t border-line p-3">
      <div className="px-2.5 py-1">
        <div className="truncate text-sm font-medium text-ink">{userName}</div>
        <div className="text-xs text-muted">{roleLabel}</div>
      </div>
      <Link
        href={isDirector ? "/aide/directeur" : "/aide/caissier"}
        target="_blank"
        className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-md px-2.5 text-sm text-gray-700 hover:bg-gray-100"
      >
        <CircleHelp size={18} strokeWidth={1.75} className="text-gray-400" aria-hidden /> Guide d&apos;utilisation
      </Link>
      <form action={logoutAction}>
        <button className="flex min-h-10 w-full items-center gap-3 rounded-md px-2.5 text-sm text-gray-700 hover:bg-gray-100">
          <LogOut size={18} strokeWidth={1.75} className="text-gray-400" aria-hidden /> Se déconnecter
        </button>
      </form>
    </div>
  );

  const tabs: NavItem[] = [
    { href: "/tableau-de-bord", label: "Accueil", icon: House },
    { href: "/eleves", label: "Élèves", icon: Users },
    { href: "/paiements/nouveau", label: "Encaisser", icon: Banknote },
    { href: "/impayes", label: "Impayés", icon: CircleAlert },
  ];

  return (
    <div className="flex min-h-full flex-1">
      {/* Menu latéral (ordinateur) */}
      <aside className="no-print hidden w-60 shrink-0 border-r border-line bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex items-center gap-3 px-4 py-4">
            {schoolBadge}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink" title={schoolName}>{schoolName}</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted"><LogoMark size={12} /> scolar</div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-2">{navigation()}</nav>
          {account}
        </div>
      </aside>

      {/* Menu complet (téléphone) */}
      {drawer && (
        <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Fermer le menu" className="absolute inset-0 bg-ink/40" onClick={close} />
          <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col bg-white">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="truncate text-sm font-semibold">{schoolName}</span>
              <button onClick={close} aria-label="Fermer" className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-2">{navigation(close)}</nav>
            {account}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
              {schoolBadge}
              <span className="truncate text-sm font-semibold">{schoolName}</span>
            </div>
            <StudentSearch className="hidden max-w-md flex-1 lg:block" />
            <button onClick={() => setSearching((s) => !s)} aria-label="Rechercher un élève" className="flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-gray-100 lg:hidden">
              <Search size={20} />
            </button>
            <Link href="/paiements/nouveau" className="hidden h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 lg:inline-flex">
              <Banknote size={17} aria-hidden /> Encaisser un paiement
            </Link>
          </div>
          {searching && (
            <div className="border-t border-line px-4 py-2 lg:hidden">
              <StudentSearch autoFocus />
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:pb-10">{children}</main>
      </div>

      {/* Barre d'onglets (téléphone) : les quatre gestes du quotidien + le menu */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navigation principale">
        <div className="grid grid-cols-5">
          {tabs.map((t) => {
            const active = isActive(pathname, t.href);
            const Icon = t.icon;
            const primary = t.href === "/paiements/nouveau";
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className="flex h-16 flex-col items-center justify-center gap-1 text-[11px]">
                <span className={cx("flex h-8 w-12 items-center justify-center rounded-full", primary ? "bg-brand-600 text-white" : active ? "bg-brand-50 text-brand-700" : "text-muted")}>
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <span className={active || primary ? "font-medium text-ink" : "text-muted"}>{t.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setDrawer(true)} className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted">
            <span className="flex h-8 w-12 items-center justify-center"><Menu size={20} strokeWidth={1.75} aria-hidden /></span>
            Menu
          </button>
        </div>
      </nav>
    </div>
  );
}
