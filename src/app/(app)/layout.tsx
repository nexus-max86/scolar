import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { ROLE_LABELS, formatDate, todayISO } from "@/lib/labels";
import { AppShell, type NavItem } from "@/components/app-shell";
import { logout } from "../(auth)/actions";

const NAV: (NavItem & { directorOnly?: boolean })[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: "▦" },
  { href: "/eleves", label: "Élèves", icon: "👤" },
  { href: "/paiements", label: "Paiements", icon: "💵" },
  { href: "/impayes", label: "Impayés", icon: "⚠" },
  { href: "/caisse", label: "Caisse du jour", icon: "🧾" },
  { href: "/classes", label: "Classes", icon: "🏫", directorOnly: true },
  { href: "/frais", label: "Frais scolaires", icon: "💲", directorOnly: true },
  { href: "/utilisateurs", label: "Utilisateurs", icon: "👥", directorOnly: true },
  { href: "/parametres", label: "Paramètres", icon: "⚙", directorOnly: true },
];

function daysLeft(end: Date | null) {
  if (!end) return null;
  const endISO = new Date(end).toISOString().slice(0, 10);
  return Math.round((Date.parse(endISO) - Date.parse(todayISO())) / 86_400_000);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, school, expired } = await requireSchoolUser();
  const nav = NAV.filter((n) => !n.directorOnly || user.role === "director").map(({ href, label, icon }) => ({ href, label, icon }));
  const left = daysLeft(school.subscription_end_date);

  let banner: React.ReactNode = null;
  if (expired) {
    banner = (
      <div className="no-print bg-red-600 px-4 py-2 text-center text-sm text-white">
        L&apos;abonnement a expiré le {formatDate(school.subscription_end_date)}. Les données restent consultables, mais
        les nouvelles saisies sont bloquées.
        {user.role === "director" && (
          <Link href="/parametres#abonnement" className="ml-2 font-semibold underline">
            Renouveler
          </Link>
        )}
      </div>
    );
  } else if (left !== null && left <= 7) {
    banner = (
      <div className="no-print bg-orange-500 px-4 py-2 text-center text-sm text-white">
        {school.status === "trial" ? "Essai gratuit" : "Abonnement"} : il reste {left} jour{left > 1 ? "s" : ""} (fin le{" "}
        {formatDate(school.subscription_end_date)}).
      </div>
    );
  }

  return (
    <>
      {banner}
      <AppShell
        nav={nav}
        schoolName={school.name}
        userName={user.name}
        roleLabel={ROLE_LABELS[user.role]}
        logoUrl={school.has_logo ? `/api/logo/${school.id}` : null}
        logoutAction={logout}
      >
        {children}
      </AppShell>
    </>
  );
}
