import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="text-sm text-muted">Cette page n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
      <Link href="/tableau-de-bord" className="font-semibold text-brand-700">Retour au tableau de bord</Link>
    </main>
  );
}
