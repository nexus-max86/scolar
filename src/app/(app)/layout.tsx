import Link from "next/link";
import { requireSchoolUser } from "@/lib/auth";
import { ROLE_LABELS, formatDate, todayISO } from "@/lib/labels";
import { AppShell } from "@/components/app-shell";
import { logout } from "../(auth)/actions";
import { DemoTour } from "@/components/demo-tour";
import { demoShowcase, tourSteps } from "@/lib/demo";
import { leaveDemo } from "../demo/actions";

function daysLeft(end: Date | null) {
  if (!end) return null;
  const endISO = new Date(end).toISOString().slice(0, 10);
  return Math.round((Date.parse(endISO) - Date.parse(todayISO())) / 86_400_000);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, school, expired } = await requireSchoolUser();
  const left = daysLeft(school.subscription_end_date);

  let banner: React.ReactNode = null;
  if (school.is_demo) {
    banner = <DemoTour steps={tourSteps(user.role, await demoShowcase(school.id))} leaveAction={leaveDemo} />;
  } else if (expired) {
    banner = (
      <div className="no-print border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800">
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
      <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
        {school.status === "trial" ? "Essai gratuit" : "Abonnement"} : il reste {left} jour{left > 1 ? "s" : ""} (fin le{" "}
        {formatDate(school.subscription_end_date)}).
      </div>
    );
  }

  return (
    <>
      {banner}
      <AppShell
        isDirector={user.role === "director"}
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
