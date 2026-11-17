import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { studentByParentToken } from "@/lib/parent";
import { classBulletins, type PeriodCode } from "@/lib/bulletin";
import { BulletinSheet, type BulletinSchool } from "@/components/bulletin-sheet";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = {
  title: "Bulletin",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Bulletin vu par le parent : seulement les périodes que l'école a publiées. */
export default async function ParentBulletinPage(props: PageProps<"/p/[token]/bulletin">) {
  const { token } = await props.params;
  const s = await studentByParentToken(token);
  if (!s) notFound();
  const [cls] = await sql<{ id: string; name: string; section: string | null; titular_name: string | null; bulletin_period: PeriodCode | null }[]>`
    select c.id, c.name, c.section, c.titular_name, c.bulletin_period
    from students st join classes c on c.id = st.class_id where st.id = ${s.id}`;
  if (!cls?.bulletin_period) notFound();
  const [school] = await sql<BulletinSchool[]>`
    select id, name, city, address, phone, director_name, logo_data is not null as has_logo, academic_year
    from schools where id = ${s.school_id}`;
  const data = await classBulletins(s.school_id, cls.id, s.academic_year, cls.bulletin_period);
  const b = data.bulletins.find((x) => x.student.id === s.id);
  if (!b) notFound();

  return (
    <div className="min-h-screen bg-canvas py-4 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] items-center justify-between gap-2 px-4">
        <Link href={`/p/${token}`} className="text-sm text-brand-700 hover:underline">← Retour</Link>
        <PrintButton />
      </div>
      <div className="overflow-x-auto px-2 print:overflow-visible print:px-0">
        <div className="min-w-[640px] print:min-w-0">
          <BulletinSheet
            school={school}
            className={`${cls.name}${cls.section ? ` (${cls.section})` : ""}`}
            titular={cls.titular_name}
            b={b}
            ranked={data.ranked}
            logoUrl={school.has_logo ? `/p/${token}/logo` : null}
          />
        </div>
      </div>
    </div>
  );
}
