import { sql } from "./db";

/**
 * Bulletins conformes aux modèles officiels (IGE/P.S) :
 * - primaire (degré élémentaire…) : trois trimestres, chacun avec deux périodes et un examen ;
 * - secondaire : deux semestres, chacun avec deux périodes (travail journalier) et un examen.
 * L'examen est noté sur le double du maximum d'une période. Certains cours n'ont pas d'examen.
 */
export type Regime = "semestre" | "trimestre";
export const REGIMES: Record<Regime, string> = {
  trimestre: "Trimestres (primaire) : 3 × (2 périodes + examen)",
  semestre: "Semestres (secondaire) : 2 × (2 périodes + examen)",
};
export function isRegime(v: unknown): v is Regime {
  return v === "semestre" || v === "trimestre";
}

export const ALL_PERIODS = ["p1", "p2", "ex1", "p3", "p4", "ex2", "p5", "p6", "ex3"] as const;
export type PeriodCode = (typeof ALL_PERIODS)[number];
export type TermKey = "t1" | "t2" | "t3";
export type Term = { key: TermKey; label: string; periods: [PeriodCode, PeriodCode]; exam: PeriodCode };

const ORD = ["Premier", "Deuxième", "Troisième"];
export function terms(regime: Regime): Term[] {
  const n = regime === "trimestre" ? 3 : 2;
  const word = regime === "trimestre" ? "trimestre" : "semestre";
  return Array.from({ length: n }, (_, i) => ({
    key: `t${i + 1}` as TermKey,
    label: regime === "semestre" && i === 1 ? "Second semestre" : `${ORD[i]} ${word}`,
    periods: [`p${2 * i + 1}`, `p${2 * i + 2}`] as [PeriodCode, PeriodCode],
    exam: `ex${i + 1}` as PeriodCode,
  }));
}
export function periodsOf(regime: Regime): PeriodCode[] {
  return terms(regime).flatMap((t) => [...t.periods, t.exam]);
}
export function isPeriod(v: unknown, regime: Regime = "trimestre"): v is PeriodCode {
  return typeof v === "string" && (periodsOf(regime) as string[]).includes(v);
}
export function isExam(code: PeriodCode) {
  return code.startsWith("ex");
}
export function periodShort(code: PeriodCode) {
  if (isExam(code)) return "Exam.";
  const n = Number(code.slice(1));
  return `${n}${n === 1 ? "re" : "e"} P`;
}
export function periodLabel(code: PeriodCode, regime: Regime = "semestre") {
  if (isExam(code)) {
    const n = Number(code.slice(2));
    return `Examen du ${n === 1 ? "1er" : `${n}e`} ${regime}`;
  }
  const n = Number(code.slice(1));
  return `${n}${n === 1 ? "re" : "e"} période`;
}
/** Maximum d'un cours pour une période : le double pour un examen. */
export function periodMax(maxPoints: number, code: PeriodCode) {
  return isExam(code) ? maxPoints * 2 : maxPoints;
}

/** Cours proposés pour démarrer vite, modifiables ensuite : [nom, maximum par période, domaine, sous-groupe, examen]. */
export type SubjectPreset = [string, number, string | null, string | null, boolean];
const DL = "Domaine des langues";
const DM = "Domaine des mathématiques, sciences et technologie";
const DU = "Domaine de l'univers social et environnement";
const DA = "Domaine des arts";
const DP = "Domaine du développement personnel";
/** Degré élémentaire (1re et 2e année), comme le modèle IGE/P.S/004. */
export const PRIMARY_SUBJECTS: SubjectPreset[] = [
  ["Expression orale", 20, DL, "Langues congolaises", true],
  ["Expression écrite", 20, DL, "Langues congolaises", true],
  ["Vocabulaire", 10, DL, "Français", true],
  ["Expression orale (français)", 20, DL, "Français", true],
  ["Lecture – écriture en langues congolaises", 30, DL, null, true],
  ["Mesures des grandeurs", 10, DM, "Mathématiques", true],
  ["Formes géométriques", 10, DM, "Mathématiques", true],
  ["Numération", 20, DM, "Mathématiques", true],
  ["Opérations", 20, DM, "Mathématiques", true],
  ["Problèmes", 20, DM, "Mathématiques", true],
  ["Sciences d'éveil", 20, DM, "Sciences", true],
  ["Technologie", 10, DM, "Technologie", true],
  ["Éducation civique et morale", 10, DU, null, true],
  ["Éducation à la santé et à l'environnement", 10, DU, null, true],
  ["Arts plastiques", 10, DA, "Éducation artistique", true],
  ["Arts dramatiques", 10, DA, "Éducation artistique", true],
  ["Éducation physique et sportive", 10, DP, null, true],
  ["Initiation aux travaux productifs", 10, DP, null, true],
  ["Religion", 10, DP, null, true],
];
/** Secondaire : cours groupés par maxima, comme le modèle IGE/P.S/2025. */
export const SECONDARY_SUBJECTS: SubjectPreset[] = [
  ["Religion", 10, null, null, true],
  ["Éducation civique et morale", 10, null, null, true],
  ["Éducation à la vie", 10, null, null, true],
  ["Anglais", 20, null, null, true],
  ["Informatique", 20, null, null, true],
  ["Histoire", 20, null, null, true],
  ["Géographie", 20, null, null, true],
  ["Physique", 20, null, null, true],
  ["Chimie", 20, null, null, true],
  ["Biologie", 20, null, null, true],
  ["Français", 50, null, null, true],
  ["Mathématiques", 50, null, null, true],
];

/** Appréciations habituelles pour l'application et la conduite. */
export const MARK_OPTIONS = ["E", "TB", "B", "AB", "M", "MA"];
export const DECISIONS = {
  passe: "L'élève passe dans la classe supérieure",
  double: "L'élève double sa classe",
  echoue: "L'élève a échoué",
} as const;
export type Decision = keyof typeof DECISIONS;

export type Subject = {
  id: string;
  name: string;
  max_points: number;
  position: number;
  domain: string | null;
  grp: string | null;
  has_exam: boolean;
};

export async function classSubjects(classId: string): Promise<Subject[]> {
  return sql<Subject[]>`
    select id, name, max_points, position, domain, grp, has_exam
    from subjects where class_id = ${classId} order by position, created_at`;
}

export type BulletinStudent = {
  id: string;
  last_name: string;
  middle_name: string | null;
  first_name: string | null;
  gender: string | null;
  birth_date: Date | null;
  birth_place: string | null;
  student_number: string;
  scolar_code: string;
  perm_number: string | null;
  national_id: string | null;
  decision: string | null;
  repechage: string | null;
  marks: Partial<Record<PeriodCode, { application: string | null; conduct: string | null }>>;
};

/** Une cellule « points / maximum ». na : pas d'examen pour ce cours. missing : période notée, mais pas pour cet élève. */
export type Cell = { points: number | null; max: number; na?: boolean; missing?: boolean };
export type ColumnKey = PeriodCode | TermKey | "total";

export type StudentBulletin = {
  student: BulletinStudent;
  rows: { subject: Subject; cells: Record<ColumnKey, Cell> }[];
  totals: Record<ColumnKey, Cell>;
  percent: Record<ColumnKey, number | null>;
  place: Record<ColumnKey, number | null>;
};

export type ClassBulletins = {
  regime: Regime;
  subjects: Subject[];
  bulletins: StudentBulletin[];
  /** Nombre d'élèves classés (ayant des points) par colonne. */
  ranked: Record<ColumnKey, number>;
  visible: PeriodCode[];
  columns: ColumnKey[];
};

export function columnsOf(regime: Regime): ColumnKey[] {
  return [...terms(regime).flatMap((t) => [...t.periods, t.exam, t.key] as ColumnKey[]), "total"];
}

/**
 * Bulletins d'une classe. `upTo` limite les périodes visibles (espace parent : jusqu'à la période publiée).
 * Les places sont calculées sur les élèves actifs de la classe qui ont au moins une note dans la colonne.
 */
export async function classBulletins(
  schoolId: string,
  classId: string,
  academicYear: string,
  regime: Regime,
  upTo?: PeriodCode | null,
): Promise<ClassBulletins> {
  const all = periodsOf(regime);
  const visible = upTo === undefined ? all : upTo === null || !all.includes(upTo) ? [] : all.slice(0, all.indexOf(upTo) + 1);
  const [subjects, students, grades, marks] = await Promise.all([
    classSubjects(classId),
    sql<Omit<BulletinStudent, "marks">[]>`
      select s.id, s.last_name, s.middle_name, s.first_name, s.gender, s.birth_date, s.birth_place, s.student_number,
             s.scolar_code, s.perm_number, s.national_id, r.decision, r.repechage
      from students s
      left join bulletin_remarks r on r.student_id = s.id and r.academic_year = ${academicYear}
      where s.school_id = ${schoolId} and s.class_id = ${classId} and s.status = 'active'
      order by s.last_name, s.middle_name, s.first_name`,
    sql<{ student_id: string; subject_id: string; period: PeriodCode; points: string }[]>`
      select g.student_id, g.subject_id, g.period, g.points
      from grades g join subjects sb on sb.id = g.subject_id
      where sb.class_id = ${classId} and g.school_id = ${schoolId}`,
    sql<{ student_id: string; period: PeriodCode; application: string | null; conduct: string | null }[]>`
      select m.student_id, m.period, m.application, m.conduct
      from bulletin_marks m join students s on s.id = m.student_id
      where s.class_id = ${classId} and m.school_id = ${schoolId} and m.academic_year = ${academicYear}`,
  ]);

  const byKey = new Map<string, number>();
  for (const g of grades) if (visible.includes(g.period)) byKey.set(`${g.student_id}|${g.subject_id}|${g.period}`, Number(g.points));

  // Les totaux ne comptent que les périodes déjà notées dans la classe : en cours d'année, le total général
  // et son pourcentage portent sur ce qui a été évalué, pas sur l'année entière.
  const graded = new Set(grades.filter((g) => visible.includes(g.period)).map((g) => g.period));
  const termOf = new Map(terms(regime).map((t) => [t.key, [...t.periods, t.exam]]));
  const columns = columnsOf(regime);
  const partsOf = (col: ColumnKey): PeriodCode[] => {
    const raw = col === "total" ? all : termOf.get(col as TermKey) ?? [col as PeriodCode];
    const vis = raw.filter((p) => visible.includes(p));
    const done = vis.filter((p) => graded.has(p));
    return vis.length > 1 && done.length > 0 ? done : vis;
  };
  const parts = new Map(columns.map((c) => [c, partsOf(c)]));

  const cell = (studentId: string, subject: Subject, col: ColumnKey): Cell => {
    if (!subject.has_exam && isExam(col as PeriodCode)) return { points: null, max: 0, na: true };
    let points: number | null = null;
    let max = 0;
    let anyGraded = false;
    for (const p of parts.get(col)!) {
      if (!subject.has_exam && isExam(p)) continue;
      max += periodMax(subject.max_points, p);
      if (graded.has(p)) anyGraded = true;
      const v = byKey.get(`${studentId}|${subject.id}|${p}`);
      if (v !== undefined) points = (points ?? 0) + v;
    }
    return { points, max, missing: points === null && anyGraded };
  };

  const markMap = new Map<string, BulletinStudent["marks"]>();
  for (const m of marks) {
    if (!visible.includes(m.period)) continue;
    const cur = markMap.get(m.student_id) ?? {};
    cur[m.period] = { application: m.application, conduct: m.conduct };
    markMap.set(m.student_id, cur);
  }

  const bulletins: StudentBulletin[] = students.map((st) => {
    const student: BulletinStudent = { ...st, marks: markMap.get(st.id) ?? {} };
    const rows = subjects.map((subject) => ({
      subject,
      cells: Object.fromEntries(columns.map((c) => [c, cell(st.id, subject, c)])) as Record<ColumnKey, Cell>,
    }));
    const totals = sumRows(rows, columns);
    const percent = Object.fromEntries(columns.map((c) => {
      const t = totals[c];
      return [c, t.points !== null && t.max > 0 ? Math.round((t.points / t.max) * 1000) / 10 : null];
    })) as Record<ColumnKey, number | null>;
    return { student, rows, totals, percent, place: {} as Record<ColumnKey, number | null> };
  });

  const ranked = {} as Record<ColumnKey, number>;
  for (const c of columns) {
    const scores = bulletins.map((b) => b.percent[c]).filter((v): v is number => v !== null);
    ranked[c] = scores.length;
    for (const b of bulletins) {
      const mine = b.percent[c];
      b.place[c] = mine === null ? null : 1 + scores.filter((v) => v > mine).length;
    }
  }
  return { regime, subjects, bulletins, ranked, visible, columns };
}

/** Somme de plusieurs lignes (sous-total, maxima généraux, totaux). */
export function sumRows(rows: { cells: Record<ColumnKey, Cell> }[], columns: ColumnKey[]): Record<ColumnKey, Cell> {
  return Object.fromEntries(columns.map((c) => {
    let points: number | null = null;
    let max = 0;
    let na = rows.length > 0;
    for (const r of rows) {
      const x = r.cells[c];
      if (!x.na) na = false;
      max += x.max;
      if (x.points !== null) points = (points ?? 0) + x.points;
    }
    return [c, { points, max, na }];
  })) as Record<ColumnKey, Cell>;
}

/**
 * Lignes du bulletin du primaire : domaines, sous-groupes et sous-totaux, comme sur le modèle officiel.
 * Un domaine qui a au moins deux sous-groupes de plusieurs cours reçoit un sous-total par sous-groupe ;
 * sinon, un seul sous-total pour le domaine.
 */
export type Line =
  | { kind: "domain"; label: string }
  | { kind: "group"; label: string }
  | { kind: "subject"; row: StudentBulletin["rows"][number] }
  | { kind: "subtotal"; cells: Record<ColumnKey, Cell>; subjects: Subject[] };

export function structuredLines(rows: StudentBulletin["rows"], columns: ColumnKey[]): Line[] {
  const domains: { label: string | null; rows: typeof rows }[] = [];
  for (const r of rows) {
    const last = domains[domains.length - 1];
    if (last && last.label === r.subject.domain) last.rows.push(r);
    else domains.push({ label: r.subject.domain, rows: [r] });
  }
  const lines: Line[] = [];
  for (const d of domains) {
    if (d.label) lines.push({ kind: "domain", label: d.label });
    const groups: { label: string | null; rows: typeof rows }[] = [];
    for (const r of d.rows) {
      const last = groups[groups.length - 1];
      if (last && last.label === r.subject.grp) last.rows.push(r);
      else groups.push({ label: r.subject.grp, rows: [r] });
    }
    const perGroup = groups.filter((g) => g.label && g.rows.length > 1).length >= 2;
    for (const g of groups) {
      if (g.label) lines.push({ kind: "group", label: g.label });
      for (const r of g.rows) lines.push({ kind: "subject", row: r });
      if (perGroup && g.label && g.rows.length > 1) lines.push({ kind: "subtotal", cells: sumRows(g.rows, columns), subjects: g.rows.map((r) => r.subject) });
    }
    if (!perGroup && d.label && d.rows.length > 1) lines.push({ kind: "subtotal", cells: sumRows(d.rows, columns), subjects: d.rows.map((r) => r.subject) });
  }
  return lines;
}

export function formatPoints(v: number | null) {
  if (v === null) return "";
  return Number.isInteger(v) ? String(v) : v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

export function formatPercent(v: number | null) {
  return v === null ? "" : `${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
