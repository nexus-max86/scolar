import { COLUMNS, formatPlace, formatPoints, type BulletinColumn, type StudentBulletin } from "@/lib/bulletin";
import { formatDate, studentFullName } from "@/lib/labels";

export type BulletinSchool = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  director_name: string | null;
  has_logo: boolean;
  academic_year: string;
};

/**
 * Bulletin au format habituel des écoles congolaises : en-tête officiel, cours groupés par maxima,
 * deux semestres (2 périodes + examen), totaux, pourcentages, places, conduite et décision.
 * Seul l'en-tête change d'une école à l'autre (nom, ville, logo).
 */
export function BulletinSheet({
  school,
  className,
  titular,
  b,
  ranked,
  logoUrl,
}: {
  school: BulletinSchool;
  className: string;
  titular: string | null;
  b: StudentBulletin;
  ranked: Record<BulletinColumn, number>;
  logoUrl?: string | null;
}) {
  const s = b.student;
  // Les cours sont groupés par maximum, comme sur les bulletins papier.
  const groups: { max: number; rows: StudentBulletin["rows"] }[] = [];
  for (const r of b.rows) {
    const last = groups[groups.length - 1];
    if (last && last.max === r.subject.max_points) last.rows.push(r);
    else groups.push({ max: r.subject.max_points, rows: [r] });
  }
  const th = "border border-gray-800 px-1 py-1 text-center font-semibold";
  const td = "border border-gray-800 px-1 py-[3px] text-center tabular-nums";
  const shade = (k: BulletinColumn) => (k === "s1" || k === "s2" || k === "total" ? "bg-gray-100" : "");

  return (
    <article className="bulletin mx-auto w-full max-w-[210mm] bg-white p-4 text-[11px] leading-tight text-black sm:p-6 print:max-w-none print:p-0">
      <header className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-b-2 border-gray-800 pb-2">
        <div className="text-[10px] font-semibold uppercase leading-snug">
          République Démocratique du Congo
          <br />
          Ministère de l&apos;Éducation Nationale
          <br />
          et Nouvelle Citoyenneté
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-16 w-16 object-contain" />
        ) : (
          <div className="h-16 w-16" />
        )}
        <div className="text-right text-[10px] leading-snug">
          <div className="text-[12px] font-bold uppercase">{school.name}</div>
          {[school.address, school.city].filter(Boolean).join(", ")}
          {school.phone && <><br />Tél. {school.phone}</>}
        </div>
      </header>

      <h1 className="my-2 text-center text-[15px] font-bold uppercase tracking-wide">
        Bulletin de l&apos;élève · Année scolaire {school.academic_year}
      </h1>

      <div className="mb-2 grid grid-cols-2 gap-x-6 gap-y-0.5 border border-gray-800 px-2 py-1.5 text-[11px]">
        <div>Élève : <strong className="uppercase">{studentFullName(s)}</strong></div>
        <div>Classe : <strong>{className}</strong></div>
        <div>Sexe : <strong>{s.gender === "F" ? "F" : s.gender === "M" ? "M" : "—"}</strong> · Né(e) le : <strong>{s.birth_date ? formatDate(s.birth_date) : "—"}</strong></div>
        <div>Matricule : <strong>{s.student_number}</strong> · Code : <strong className="font-mono">{s.scolar_code}</strong></div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th rowSpan={2} className={`${th} w-[28%] text-left`}>Branches</th>
            <th colSpan={4} className={th}>1er semestre</th>
            <th colSpan={4} className={th}>2e semestre</th>
            <th rowSpan={2} className={`${th} bg-gray-100`}>Total général</th>
          </tr>
          <tr>
            {COLUMNS.filter((c) => c.key !== "total").map((c) => (
              <th key={c.key} className={`${th} ${shade(c.key)}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => (
            <Group key={gi} max={g.max} rows={g.rows} td={td} shade={shade} />
          ))}
          <tr className="font-semibold">
            <td className={`${td} text-left`}>Maxima généraux</td>
            {COLUMNS.map((c) => <td key={c.key} className={`${td} ${shade(c.key)}`}>{b.totals[c.key].max || ""}</td>)}
          </tr>
          <tr className="font-bold">
            <td className={`${td} text-left`}>Totaux</td>
            {COLUMNS.map((c) => <td key={c.key} className={`${td} ${shade(c.key)}`}>{formatPoints(b.totals[c.key].points)}</td>)}
          </tr>
          <tr className="font-bold">
            <td className={`${td} text-left`}>Pourcentage</td>
            {COLUMNS.map((c) => (
              <td key={c.key} className={`${td} ${shade(c.key)}`}>
                {b.percent[c.key] === null ? "" : `${b.percent[c.key]!.toLocaleString("fr-FR")} %`}
              </td>
            ))}
          </tr>
          <tr>
            <td className={`${td} text-left`}>Place / nombre d&apos;élèves</td>
            {COLUMNS.map((c) => <td key={c.key} className={`${td} ${shade(c.key)}`}>{formatPlace(b.place[c.key], ranked[c.key], s.gender)}</td>)}
          </tr>
          <tr>
            <td className={`${td} text-left`}>Conduite</td>
            <td colSpan={COLUMNS.length} className={`${td} text-left`}>{s.conduct ?? ""}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 print:grid-cols-2">
        <div className="border border-gray-800 px-2 py-1.5">
          <div className="font-semibold">Observation du titulaire</div>
          <div className="min-h-8">{s.remark ?? ""}</div>
        </div>
        <div className="border border-gray-800 px-2 py-1.5">
          <div className="font-semibold">Décision</div>
          <div className="min-h-8">{s.decision ?? ""}</div>
        </div>
      </div>

      <footer className="mt-4 grid grid-cols-3 gap-4 text-center text-[10px]">
        <div>
          Le titulaire
          <div className="mt-8 border-t border-gray-500 pt-0.5">{titular ?? ""}</div>
        </div>
        <div>
          Sceau de l&apos;école
          <div className="mx-auto mt-2 h-12 w-12 rounded-full border border-dashed border-gray-400" />
        </div>
        <div>
          Le chef d&apos;établissement
          <div className="mt-8 border-t border-gray-500 pt-0.5">{school.director_name ?? ""}</div>
        </div>
      </footer>
      <p className="mt-3 text-center text-[9px] text-gray-500">
        Fait à {school.city ?? "…"}, le {formatDate(new Date())} · Bulletin électronique Scolar · Toute rature ou surcharge le rend invalide.
      </p>
    </article>
  );
}

function Group({ rows, td, shade }: { max: number; rows: StudentBulletin["rows"]; td: string; shade: (k: BulletinColumn) => string }) {
  return (
    <>
      <tr className="bg-gray-50 font-semibold">
        <td className={`${td} text-left`}>Maxima</td>
        {COLUMNS.map((c) => <td key={c.key} className={`${td} ${shade(c.key)}`}>{rows[0].cells[c.key].max || ""}</td>)}
      </tr>
      {rows.map((r) => (
        <tr key={r.subject.id}>
          <td className={`${td} text-left`}>{r.subject.name}</td>
          {COLUMNS.map((c) => <td key={c.key} className={`${td} ${shade(c.key)}`}>{formatPoints(r.cells[c.key].points)}</td>)}
        </tr>
      ))}
    </>
  );
}
