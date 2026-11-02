import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./ui";

/** Met en gras les passages entre ** ** (noms de boutons et de menus). */
export function Rich({ text }: { text: string }) {
  const parts = text.split("**");
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i} className="font-semibold text-ink">{p}</strong> : p))}</>;
}

export function GuideShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="no-print sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Accueil"><Wordmark /></Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-4">
            <Link href="/aide" className="px-2 text-muted hover:text-ink">Guides</Link>
            <Link href="/demo" className="hidden px-2 text-muted hover:text-ink sm:inline">Démo</Link>
            <Link href="/connexion" className="px-2 font-medium text-ink hover:text-brand-600">Se connecter</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="no-print border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted sm:px-6">© {new Date().getFullYear()} Scolar · Kinshasa</div>
      </footer>
    </div>
  );
}
