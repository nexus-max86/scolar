import type { ReactNode } from "react";
import {
  DECISIONS, formatPercent, formatPoints, isExam, periodMax, structuredLines, sumRows, terms,
  type Cell, type ColumnKey, type Decision, type PeriodCode, type Regime, type StudentBulletin, type Subject,
} from "@/lib/bulletin";
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
  province: string | null;
  commune: string | null;
  school_code: string | null;
};

type Props = {
  school: BulletinSchool;
  className: string;
  title: string | null;
  regime: Regime;
  b: StudentBulletin;
  ranked: Record<ColumnKey, number>;
  columns: ColumnKey[];
  logoUrl?: string | null;
};

/**
 * Bulletin au format des modèles officiels (IGE/P.S). Même en-tête pour toutes les écoles ;
 * le tableau suit le modèle du primaire (trimestres, domaines, sous-totaux)
 * ou celui du secondaire (semestres, cours groupés par maxima, repêchage).
 */
export function BulletinSheet(props: Props) {
  return (
    <article className="bulletin mx-auto w-full max-w-[210mm] bg-white p-3 font-serif text-[10px] leading-tight text-black sm:p-5 print:max-w-none print:p-0">
      <Header {...props} />
      {props.regime === "trimestre" ? <PrimaryTable {...props} /> : <SecondaryTable {...props} />}
    </article>
  );
}

const B = "border border-black";
const td = `${B} px-0.5 py-[2px] text-center tabular-nums print:py-0`;
const hatch = "bg-[repeating-linear-gradient(90deg,#000_0_1px,#fff_1px_3px)]";

function Flag() {
  return (
    <svg viewBox="0 0 800 600" className="h-11 w-[58px] border border-gray-400" aria-label="Drapeau de la RDC">
      <rect width="800" height="600" fill="#007fff" />
      <polygon points="0,600 0,450 600,0 800,0 800,150 200,600" fill="#f7d618" />
      <polygon points="0,600 0,510 680,0 800,0 800,90 120,600" fill="#ce1021" />
      <polygon points="140,40 163,110 237,110 177,153 200,223 140,180 80,223 103,153 43,110 117,110" fill="#f7d618" />
    </svg>
  );
}

/** Cases à remplir, une par caractère (N° ID, code de l'école, N° permanent). */
function Boxes({ value, count }: { value: string | null; count: number }) {
  const chars = Array.from(value ?? "").slice(0, count);
  return (
    <span className="inline-flex">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="-ml-px inline-flex h-[15px] w-[13px] items-center justify-center border border-black text-[10px] font-semibold first:ml-0">
          {chars[i] ?? ""}
        </span>
      ))}
    </span>
  );
}

function Dots({ children }: { children?: ReactNode }) {
  return children ? <strong className="uppercase">{children}</strong> : <span className="text-gray-500">……………………………</span>;
}

function Header({ school, className, title, b, logoUrl }: Props) {
  const s = b.student;
  return (
    <>
      <header className={`${B} grid grid-cols-[64px_1fr_64px] items-center gap-2 px-2 py-1.5`}>
        <Flag />
        <div className="text-center text-[12px] font-bold uppercase leading-snug">
          République Démocratique du Congo
          <br />
          Ministère de l&apos;Éducation Nationale
          <br />
          et Nouvelle Citoyenneté
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="ml-auto h-12 w-12 object-contain" />
        ) : <span />}
      </header>
      <div className={`${B} -mt-px flex items-center gap-3 px-2 py-1 font-bold`}>
        N° ID <Boxes value={s.national_id} count={24} />
      </div>
      <div className={`${B} -mt-px grid grid-cols-2`}>
        <div className="space-y-1 border-r border-black px-2 py-1.5">
          <div>PROVINCE ÉDUCATIONNELLE : <Dots>{school.province}</Dots></div>
          <div>VILLE : <Dots>{school.city}</Dots></div>
          <div>COMMUNE / TER. <sup>(1)</sup> : <Dots>{school.commune}</Dots></div>
          <div>ÉCOLE : <Dots>{school.name}</Dots></div>
          <div className="flex items-center gap-2">CODE : <Boxes value={school.school_code} count={10} /></div>
        </div>
        <div className="space-y-1 px-2 py-1.5">
          <div className="flex justify-between gap-2"><span>ÉLÈVE : <Dots>{studentFullName(s)}</Dots></span><span>SEXE : <Dots>{s.gender}</Dots></span></div>
          <div className="flex justify-between gap-2">
            <span>NÉ(E) À : <Dots>{s.birth_place}</Dots></span>
            <span>LE : {s.birth_date ? <strong>{formatDate(s.birth_date)}</strong> : <span className="text-gray-500">…/…/……</span>}</span>
          </div>
          <div>CLASSE : <Dots>{className}</Dots></div>
          <div className="flex items-center gap-2">N° PERM. : <Boxes value={s.perm_number} count={14} /></div>
        </div>
      </div>
      <div className={`${B} -mt-px flex flex-wrap items-center justify-between gap-2 px-2 py-1 text-[11px] font-bold uppercase`}>
        <span>{title || `Bulletin de l'élève · ${className}`}</span>
        <span>Année scolaire {school.academic_year}</span>
      </div>
    </>
  );
}

function pts(c: Cell) {
  if (c.na) return "";
  if (c.points === null) return c.missing ? "-" : "";
  return formatPoints(c.points);
}

/** Maxima « structurels » d'un cours, pour les colonnes MAX (indépendants des périodes déjà notées). */
function structMax(sub: Pick<Subject, "max_points" | "has_exam">, key: ColumnKey, regime: Regime): number | null {
  const ts = terms(regime);
  const term = (sub.has_exam ? 4 : 2) * sub.max_points;
  if (key === "total") return term * ts.length;
  if (key.startsWith("t")) return term;
  if (isExam(key as never)) return sub.has_exam ? periodMax(sub.max_points, key as never) : null;
  return sub.max_points;
}

function sumMax(subjects: Subject[], key: ColumnKey, regime: Regime) {
  return subjects.reduce((n, s) => n + (structMax(s, key, regime) ?? 0), 0);
}

function Decisions({ decision, compact }: { decision: string | null; compact?: boolean }) {
  const d = decision as Decision | null;
  const list: [Decision, string][] = compact
    ? [["passe", "Passe"], ["double", "Double"], ["echoue", "A échoué"]]
    : [["passe", DECISIONS.passe], ["double", DECISIONS.double]];
  return (
    <>
      {list.map(([k, label]) => (
        <div key={k} className={d && d !== k ? "line-through decoration-2" : d === k ? "font-bold" : ""}>- {label} <sup>(1)</sup></div>
      ))}
    </>
  );
}

/* ───────────── Primaire : trimestres, domaines et sous-totaux ───────────── */

function PrimaryTable({ b, ranked, columns, school, regime }: Props) {
  const ts = terms(regime);
  const lines = structuredLines(b.rows, columns);
  const subjects = b.rows.map((r) => r.subject);
  const width = 2 + ts.length * 6 + 2;
  const th = `${B} px-0.5 py-0.5 text-center text-[7px] font-semibold uppercase leading-[1.1]`;

  const valueCells = (cells: Record<ColumnKey, Cell>, maxOf: (k: ColumnKey) => number | null, bold?: boolean) => (
    <>
      <td className={td}>{maxOf("p1")}</td>
      {ts.map((t) => (
        <TermCells key={t.key} t={t} cells={cells} maxOf={maxOf} bold={bold} />
      ))}
      <td className={td}>{maxOf("total")}</td>
      <td className={`${td} font-semibold`}>{pts(cells.total)}</td>
    </>
  );
  // Lignes du bas : valeur seulement sous les colonnes « points obtenus ».
  const footRow = (label: string, value: (k: ColumnKey) => ReactNode, onlyPeriods = false) => (
    <tr>
      <td className={`${td} text-left font-bold uppercase`}>{label}</td>
      <td className={`${td} ${hatch}`} />
      {ts.map((t) => (
        <FootTerm key={t.key} t={t} value={value} onlyPeriods={onlyPeriods} />
      ))}
      <td className={`${td} ${hatch}`} />
      <td className={td}>{onlyPeriods ? "" : value("total")}</td>
    </tr>
  );

  return (
    <>
      <table className="-mt-px w-full border-collapse text-[8.5px]">
        <thead>
          <tr>
            <th rowSpan={2} className={`${th} w-[23%] text-[10px] tracking-[0.2em]`}>Branches</th>
            <th rowSpan={2} className={th}>Max per</th>
            {ts.map((t) => <th key={t.key} colSpan={6} className={th}>{t.label}</th>)}
            <th colSpan={2} className={th}>Total</th>
          </tr>
          <tr>
            {ts.map((t) => (
              <TermHead key={t.key} t={t} th={th} />
            ))}
            <th className={th}>Max.</th>
            <th className={th}>Pts obt.</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            if (l.kind === "domain") {
              return <tr key={i}><td colSpan={width} className={`${td} bg-gray-200 font-bold uppercase`}>{l.label}</td></tr>;
            }
            if (l.kind === "group") {
              return <tr key={i}><td colSpan={width} className={`${td} bg-gray-100 text-left font-bold uppercase`}>{l.label}</td></tr>;
            }
            if (l.kind === "subtotal") {
              return (
                <tr key={i} className="font-bold">
                  <td className={`${td} text-left`}>Sous-total</td>
                  {valueCells(l.cells, (k) => sumMax(l.subjects, k, regime), true)}
                </tr>
              );
            }
            const r = l.row;
            return (
              <tr key={i}>
                <td className={`${td} text-left`}>{r.subject.name}</td>
                {valueCells(r.cells, (k) => structMax(r.subject, k, regime))}
              </tr>
            );
          })}
          <tr className="font-bold">
            <td className={`${td} text-left text-[10px]`}>Maxima généraux</td>
            {valueCells(sumRows([], columns), (k) => sumMax(subjects, k, regime))}
          </tr>
          {footRow("Totaux", (k) => pts(b.totals[k]))}
          {footRow("Pourcentage", (k) => formatPercent(b.percent[k]))}
          {footRow("Place", (k) => b.place[k] ?? "")}
          {footRow("Nbre d'élèves", (k) => (b.place[k] ? ranked[k] : ""))}
          {footRow("Application", (k) => b.student.marks[k as PeriodCode]?.application ?? "", true)}
          {footRow("Conduite", (k) => b.student.marks[k as PeriodCode]?.conduct ?? "", true)}
          {footRow("Signat. de l'inst.", () => "", true)}
          {footRow("Signat. du resp.", () => "", true)}
        </tbody>
      </table>
      <div className={`${B} -mt-px grid grid-cols-2 gap-2 px-2 py-2`}>
        <div className="space-y-0.5"><Decisions decision={b.student.decision} /></div>
        <div className="text-right">Fait à <Dots>{school.city}</Dots>, le …… / …… / ……</div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
        <div>Signature de l&apos;élève</div>
        <div className="pt-3">Sceau de l&apos;école</div>
        <div>Chef d&apos;Établissement<div className="mt-4 font-normal print:mt-3">{school.director_name ?? "Noms & Signature"}</div></div>
      </div>
      <Footnotes code="IGE/P.S/004" forbid />
    </>
  );
}

function TermHead({ t, th }: { t: ReturnType<typeof terms>[number]; th: string }) {
  return (
    <>
      <th className={th}>{t.periods[0].slice(1)}{t.periods[0] === "p1" ? "re" : "e"} P</th>
      <th className={th}>{t.periods[1].slice(1)}e P</th>
      <th className={th}>Max. ex.</th>
      <th className={th}>Pts obt.</th>
      <th className={th}>Max. trim.</th>
      <th className={th}>Pts obt.</th>
    </>
  );
}

function TermCells({ t, cells, maxOf, bold }: {
  t: ReturnType<typeof terms>[number]; cells: Record<ColumnKey, Cell>; maxOf: (k: ColumnKey) => number | null; bold?: boolean;
}) {
  const exMax = maxOf(t.exam);
  return (
    <>
      <td className={td}>{pts(cells[t.periods[0]])}</td>
      <td className={td}>{pts(cells[t.periods[1]])}</td>
      <td className={`${td} ${exMax === null ? "bg-black" : ""}`}>{exMax || ""}</td>
      <td className={`${td} ${cells[t.exam].na ? "bg-black" : ""}`}>{pts(cells[t.exam])}</td>
      <td className={td}>{maxOf(t.key)}</td>
      <td className={`${td} ${bold ? "" : "font-semibold"}`}>{pts(cells[t.key])}</td>
    </>
  );
}

function FootTerm({ t, value, onlyPeriods }: { t: ReturnType<typeof terms>[number]; value: (k: ColumnKey) => ReactNode; onlyPeriods: boolean }) {
  return (
    <>
      <td className={td}>{value(t.periods[0])}</td>
      <td className={td}>{value(t.periods[1])}</td>
      <td className={`${td} ${hatch}`} />
      <td className={`${td} ${onlyPeriods ? hatch : ""}`}>{onlyPeriods ? "" : value(t.exam)}</td>
      <td className={`${td} ${hatch}`} />
      <td className={`${td} ${onlyPeriods ? hatch : ""}`}>{onlyPeriods ? "" : value(t.key)}</td>
    </>
  );
}

/* ───────────── Secondaire : semestres, cours groupés par maxima ───────────── */

function SecondaryTable({ b, ranked, school, regime }: Props) {
  const ts = terms(regime);
  const th = `${B} px-0.5 py-0.5 text-center font-bold uppercase leading-[1.1]`;
  // Cours groupés par maximum (et avec / sans examen), comme sur le modèle.
  const groups: { subject: Subject; rows: StudentBulletin["rows"] }[] = [];
  for (const r of b.rows) {
    const last = groups[groups.length - 1];
    if (last && last.subject.max_points === r.subject.max_points && last.subject.has_exam === r.subject.has_exam) last.rows.push(r);
    else groups.push({ subject: r.subject, rows: [r] });
  }
  const subjects = b.rows.map((r) => r.subject);
  const black = "bg-black";
  const keysOf = (t: (typeof ts)[number]): ColumnKey[] => [t.periods[0], t.periods[1], t.exam, t.key];

  const maxRow = (label: string, maxOf: (k: ColumnKey) => number | null, big?: boolean) => (
    <tr className="font-bold">
      <td className={`${td} text-left uppercase ${big ? "text-[10px]" : ""}`}>{label}</td>
      {ts.flatMap((t) => keysOf(t)).map((k) => {
        const m = maxOf(k);
        return <td key={k} className={`${td} ${m === null ? black : ""}`}>{m ?? ""}</td>;
      })}
      <td className={td}>{maxOf("total")}</td>
      <td className={black} />
      <td colSpan={2} className={black} />
    </tr>
  );
  const decisionRows = 6;
  const footRow = (label: string, value: (k: ColumnKey) => ReactNode, i: number, onlyPeriods = false) => (
    <tr>
      <td className={`${td} text-left font-bold uppercase`}>{label}</td>
      {ts.flatMap((t) => keysOf(t)).map((k) => {
        const off = onlyPeriods && (isExam(k as PeriodCode) || k.startsWith("t"));
        return <td key={k} className={`${td} ${off ? black : ""} ${label === "Totaux" ? "font-bold italic" : ""}`}>{off ? "" : value(k)}</td>;
      })}
      <td className={`${td} ${onlyPeriods ? black : ""}`}>{onlyPeriods ? "" : value("total")}</td>
      <td className={black} />
      {i === 0 && (
        <td colSpan={2} rowSpan={decisionRows} className={`${B} px-1 py-1 align-top text-[9px]`}>
          <Decisions decision={b.student.decision} compact />
          <div className="mt-2">Le …… / …… / {school.academic_year.slice(-4)}</div>
          <div className="mt-1 font-bold">Le Chef d&apos;Établiss.</div>
          <div className="mt-1">Sceau de l&apos;école</div>
        </td>
      )}
    </tr>
  );

  return (
    <>
      <table className="-mt-px w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th rowSpan={3} className={`${th} w-[30%] text-[13px]`}>Branches</th>
            {ts.map((t) => <th key={t.key} colSpan={4} className={th}>{t.label}</th>)}
            <th rowSpan={3} className={th}>T.G</th>
            <th rowSpan={3} className={`${black} w-3`} />
            <th colSpan={2} className={`${th} text-[8px]`}>Examen de repêchage</th>
          </tr>
          <tr>
            {ts.map((t) => (
              <SecHead key={t.key} t={t} th={th} />
            ))}
            <th rowSpan={2} className={th}>%</th>
            <th rowSpan={2} className={`${th} text-[8px]`}>Sign. Prof</th>
          </tr>
          <tr>
            {ts.map((t) => t.periods.map((p) => <th key={p} className={th}>{p.slice(1)}<sup>{p === "p1" ? "re" : "e"}</sup> P</th>))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => (
            <SecGroup key={gi} g={g} ts={ts} regime={regime} keysOf={keysOf} />
          ))}
          {maxRow("Maxima généraux", (k) => {
            const anyExam = subjects.some((s) => s.has_exam);
            if (isExam(k as PeriodCode) && !anyExam) return null;
            return sumMax(subjects, k, regime);
          }, true)}
          {footRow("Totaux", (k) => pts(b.totals[k]), 0)}
          {footRow("Pourcentage", (k) => formatPercent(b.percent[k]), 1)}
          {footRow("Place/Nbre d'élève", (k) => (b.place[k] ? `${b.place[k]}/${ranked[k]}` : ""), 2)}
          {footRow("Application", (k) => b.student.marks[k as PeriodCode]?.application ?? "", 3, true)}
          {footRow("Conduite", (k) => b.student.marks[k as PeriodCode]?.conduct ?? "", 4, true)}
          {footRow("Signature", () => "", 5, true)}
        </tbody>
      </table>
      <div className={`${B} -mt-px px-2 py-1.5`}>
        - L&apos;élève ne pourra passer dans la classe supérieure s&apos;il n&apos;a subi avec succès un examen de repêchage en{" "}
        {b.student.repechage ? <strong>{b.student.repechage}</strong> : "……………………………………………………"} <sup>(1)</sup>
      </div>
      <div className={`${B} -mt-px grid grid-cols-2 gap-2 px-2 py-2`}>
        <div className="space-y-0.5"><Decisions decision={b.student.decision} /></div>
        <div className="text-right">Fait à {school.city ?? "……………"}, le …… / …… / {school.academic_year.slice(-4)}</div>
        <div className="mt-2 text-center font-bold">Sceau de l&apos;école</div>
        <div className="mt-2 text-center font-bold">Le Chef d&apos;Établissement</div>
        <div className="mt-3 font-bold">Signature de l&apos;élève</div>
        <div className="mt-3 text-center font-bold uppercase">{school.director_name ?? ""}</div>
      </div>
      <Footnotes code={`IGE/P.S/${school.academic_year.slice(-4)}`} />
    </>
  );
}

function SecHead({ t, th }: { t: ReturnType<typeof terms>[number]; th: string }) {
  return (
    <>
      <th colSpan={2} className={`${th} text-[8px]`}>Tr. journal</th>
      <th rowSpan={2} className={th}>Exam</th>
      <th rowSpan={2} className={th}>Total</th>
    </>
  );
}

function SecGroup({ g, ts, regime, keysOf }: {
  g: { subject: Subject; rows: StudentBulletin["rows"] };
  ts: ReturnType<typeof terms>;
  regime: Regime;
  keysOf: (t: ReturnType<typeof terms>[number]) => ColumnKey[];
}) {
  return (
    <>
      <tr className="font-bold">
        <td className={`${td} text-left`}>MAXIMA</td>
        {ts.flatMap((t) => keysOf(t)).map((k) => {
          const m = structMax(g.subject, k, regime);
          return <td key={k} className={`${td} ${m === null ? "bg-black" : ""}`}>{m ?? ""}</td>;
        })}
        <td className={td}>{structMax(g.subject, "total", regime)}</td>
        <td className="bg-black" />
        <td colSpan={2} className="bg-black" />
      </tr>
      {g.rows.map((r) => (
        <tr key={r.subject.id}>
          <td className={`${td} text-left`}>{r.subject.name}</td>
          {ts.flatMap((t) => keysOf(t)).map((k) => (
            <td key={k} className={`${td} ${r.cells[k].na ? "bg-black" : ""} ${k.startsWith("t") ? "font-semibold" : ""}`}>{pts(r.cells[k])}</td>
          ))}
          <td className={`${td} font-semibold`}>{pts(r.cells.total)}</td>
          <td className="bg-black" />
          <td className={td} />
          <td className={td} />
        </tr>
      ))}
    </>
  );
}

function Footnotes({ code, forbid }: { code: string; forbid?: boolean }) {
  return (
    <div className="mt-2 flex items-end justify-between gap-3 text-[8.5px]">
      <div>
        <div>(1) Biffer la mention inutile.</div>
        <div>Note importante : le bulletin est sans valeur s&apos;il est raturé ou surchargé.</div>
        {forbid && <div className="italic">Interdiction formelle de reproduire ce bulletin sous peine des sanctions prévues par la loi.</div>}
      </div>
      <div className="shrink-0 font-bold italic">{code}</div>
    </div>
  );
}
