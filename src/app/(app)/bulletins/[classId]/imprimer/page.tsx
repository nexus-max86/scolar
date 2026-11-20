import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";
import { classBulletins, type Regime } from "@/lib/bulletin";
import { BulletinSheet, type BulletinSchool } from "@/components/bulletin-sheet";
import { PrintButton } from "@/components/print-button";
import { Alert, LinkButton } from "@/components/ui";

export const metadata = { title: "Imprimer les bulletins" };

/** Bulletins prêts à imprimer (un par page A4) ou à enregistrer en PDF depuis le navigateur. */
export default async function PrintBulletinsPage(props: PageProps<"/bulletins/[classId]/imprimer">) {
  const { classId } = await props.params;
  const sp = await props.searchParams;
  const { school: current } = await requireSchoolUser();
  if (!isUuid(classId)) notFound();
  const [cls] = await sql<{ name: string; section: string | null; bulletin_regime: Regime; bulletin_title: string | null }[]>`
    select name, section, bulletin_regime, bulletin_title from classes where id = ${classId} and school_id = ${current.id}`;
  if (!cls) notFound();
  const [school] = await sql<BulletinSchool[]>`
    select id, name, city, address, phone, director_name, logo_data is not null as has_logo, academic_year,
           province, commune, school_code
    from schools where id = ${current.id}`;
  const data = await classBulletins(current.id, classId, current.academic_year, cls.bulletin_regime);
  const only = typeof sp.eleve === "string" ? sp.eleve : null;
  const list = only ? data.bulletins.filter((b) => b.student.id === only) : data.bulletins;
  const className = `${cls.name}${cls.section ? ` (${cls.section})` : ""}`;

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <PrintButton />
        <LinkButton href={`/bulletins/${classId}?onglet=resultats`} variant="ghost">Retour à la classe</LinkButton>
        <span className="text-sm text-muted">
          {list.length} bulletin{list.length > 1 ? "s" : ""} · Pour un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d&apos;impression.
        </span>
      </div>
      {list.length === 0 && <Alert kind="info">Aucun bulletin à imprimer.</Alert>}
      <div className="space-y-6 print:space-y-0">
        {list.map((b) => (
          <div key={b.student.id} className="break-after-page rounded-[var(--radius-card)] border border-line print:rounded-none print:border-0">
            <BulletinSheet school={school} className={className} title={cls.bulletin_title} regime={data.regime} columns={data.columns}
              b={b} ranked={data.ranked} logoUrl={school.has_logo ? `/api/logo/${school.id}` : null} />
          </div>
        ))}
      </div>
    </>
  );
}
