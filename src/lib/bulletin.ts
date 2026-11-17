import { sql } from "./db";

/**
 * Bulletin standard au format habituel en RDC : deux semestres, chacun avec deux périodes
 * et un examen. L'examen est noté sur le double du maximum d'une période.
 */
export const PERIODS = [
  { code: "p1", label: "1re période", short: "1re P", semester: 1, exam: false },
  { code: "p2", label: "2e période", short: "2e P", semester: 1, exam: false },
  { code: "ex1", label: "Examen du 1er semestre", short: "Exam.", semester: 1, exam: true },
  { code: "p3", label: "3e période", short: "3e P", semester: 2, exam: false },
  { code: "p4", label: "4e période", short: "4e P", semester: 2, exam: false },
  { code: "ex2", label: "Examen du 2e semestre", short: "Exam.", semester: 2, exam: true },
] as const;
export type PeriodCode = (typeof PERIODS)[number]["code"];
export const PERIOD_CODES = PERIODS.map((p) => p.code) as PeriodCode[];

export function isPeriod(v: unknown): v is PeriodCode {
  return typeof v === "string" && (PERIOD_CODES as string[]).includes(v);
}
export function periodLabel(code: PeriodCode) {
  return PERIODS.find((p) => p.code === code)!.label;
}
/** Maximum d'un cours pour une période : le double pour un examen. */
export function periodMax(maxPoints: number, code: PeriodCode) {
  return code === "ex1" || code === "ex2" ? maxPoints * 2 : maxPoints;
}

/** Cours proposés pour démarrer vite (primaire), modifiables ensuite. */
export const PRIMARY_SUBJECTS: [string, number][] = [
  ["Religion", 10],
  ["Éducation civique et morale", 10],
  ["Éducation à la vie", 10],
  ["Français", 40],
  ["Langues congolaises", 20],
  ["Mathématiques", 40],
  ["Sciences d'éveil", 20],
  ["Géographie", 10],
  ["Histoire", 10],
  ["Dessin", 10],
  ["Calligraphie", 10],
  ["Éducation physique et sportive", 10],
];
export const SECONDARY_SUBJECTS: [string, number][] = [
  ["Religion", 20],
  ["Éducation civique et morale", 20],
  ["Français", 80],
  ["Anglais", 40],
  ["Mathématiques", 80],
  ["Physique", 40],
  ["Chimie", 40],
  ["Biologie", 40],
  ["Histoire", 20],
  ["Géographie", 20],
  ["Informatique", 20],
  ["Éducation physique", 20],
];

export const CONDUCT_OPTIONS = ["Élite", "Très bien", "Bien", "Assez bien", "Médiocre", "Mauvais"];
export const DECISION_OPTIONS = [
  "Passe dans la classe supérieure",
  "Passe avec réserve",
  "Double sa classe",
  "Est orienté(e) vers une autre section",
  "Ajourné(e) : seconde session",
];

export type Subject = { id: string; name: string; max_points: number; position: number };

export async function classSubjects(classId: string): Promise<Subject[]> {
  return sql<Subject[]>`select id, name, max_points, position from subjects where class_id = ${classId} order by position, created_at`;
}

export type BulletinStudent = {
  id: string;
  last_name: string;
  middle_name: string | null;
  first_name: string | null;
  gender: string | null;
  birth_date: Date | null;
  student_number: string;
  scolar_code: string;
  conduct: string | null;
  remark: string | null;
  decision: string | null;
};

/** Une cellule « points / maximum » d'une colonne du bulletin. */
export type Cell = { points: number | null; max: number };

export type BulletinColumn = PeriodCode | "s1" | "s2" | "total";
export const COLUMNS: { key: BulletinColumn; label: string }[] = [
  { key: "p1", label: "1re P" }, { key: "p2", label: "2e P" }, { key: "ex1", label: "Exam." }, { key: "s1", label: "Total" },
  { key: "p3", label: "3e P" }, { key: "p4", label: "4e P" }, { key: "ex2", label: "Exam." }, { key: "s2", label: "Total" },
  { key: "total", label: "Total général" },
];
const PARTS: Record<BulletinColumn, PeriodCode[]> = {
  p1: ["p1"], p2: ["p2"], ex1: ["ex1"], p3: ["p3"], p4: ["p4"], ex2: ["ex2"],
  s1: ["p1", "p2", "ex1"], s2: ["p3", "p4", "ex2"], total: ["p1", "p2", "ex1", "p3", "p4", "ex2"],
};

export type StudentBulletin = {
  student: BulletinStudent;
  rows: { subject: Subject; cells: Record<BulletinColumn, Cell> }[];
  totals: Record<BulletinColumn, Cell>;
  percent: Record<BulletinColumn, number | null>;
  place: Record<BulletinColumn, number | null>;
};

export type ClassBulletins = {
  subjects: Subject[];
  bulletins: StudentBulletin[];
  /** Nombre d'élèves classés (ayant des points) par colonne. */
  ranked: Record<BulletinColumn, number>;
  visible: PeriodCode[];
};

/**
 * Bulletins d'une classe. `upTo` limite les périodes visibles (espace parent : jusqu'à la période publiée).
 * Les places sont calculées sur les élèves actifs de la classe qui ont au moins une note dans la colonne.
 */
export async function classBulletins(schoolId: string, classId: string, academicYear: string, upTo?: PeriodCode | null): Promise<ClassBulletins> {
  const visible = upTo === undefined ? PERIOD_CODES : upTo === null ? [] : PERIOD_CODES.slice(0, PERIOD_CODES.indexOf(upTo) + 1);
  const [subjects, students, grades] = await Promise.all([
    classSubjects(classId),
    sql<BulletinStudent[]>`
      select s.id, s.last_name, s.middle_name, s.first_name, s.gender, s.birth_date, s.student_number, s.scolar_code,
             r.conduct, r.remark, r.decision
      from students s
      left join bulletin_remarks r on r.student_id = s.id and r.academic_year = ${academicYear}
      where s.school_id = ${schoolId} and s.class_id = ${classId} and s.status = 'active'
      order by s.last_name, s.middle_name, s.first_name`,
    sql<{ student_id: string; subject_id: string; period: PeriodCode; points: string }[]>`
      select g.student_id, g.subject_id, g.period, g.points
      from grades g join subjects sb on sb.id = g.subject_id
      where sb.class_id = ${classId} and g.school_id = ${schoolId}`,
  ]);

  const byKey = new Map<string, number>();
  for (const g of grades) if (visible.includes(g.period)) byKey.set(`${g.student_id}|${g.subject_id}|${g.period}`, Number(g.points));

  // Les totaux ne comptent que les périodes déjà notées dans la classe : en cours d'année, le total général
  // et son pourcentage portent sur ce qui a été évalué, pas sur l'année entière.
  const graded = new Set(grades.filter((g) => visible.includes(g.period)).map((g) => g.period));
  const parts = (col: BulletinColumn) => {
    const all = PARTS[col].filter((p) => visible.includes(p));
    const done = all.filter((p) => graded.has(p));
    return all.length > 1 && done.length > 0 ? done : all;
  };

  const cell = (studentId: string, subject: Subject, col: BulletinColumn): Cell => {
    let points: number | null = null;
    let max = 0;
    for (const p of parts(col)) {
      max += periodMax(subject.max_points, p);
      const v = byKey.get(`${studentId}|${subject.id}|${p}`);
      if (v !== undefined) points = (points ?? 0) + v;
    }
    return { points, max };
  };

  const bulletins: StudentBulletin[] = students.map((student) => {
    const rows = subjects.map((subject) => ({
      subject,
      cells: Object.fromEntries(COLUMNS.map((c) => [c.key, cell(student.id, subject, c.key)])) as Record<BulletinColumn, Cell>,
    }));
    const totals = Object.fromEntries(COLUMNS.map((c) => {
      let points: number | null = null;
      let max = 0;
      for (const r of rows) {
        max += r.cells[c.key].max;
        if (r.cells[c.key].points !== null) points = (points ?? 0) + r.cells[c.key].points!;
      }
      return [c.key, { points, max }];
    })) as Record<BulletinColumn, Cell>;
    const percent = Object.fromEntries(COLUMNS.map((c) => {
      const t = totals[c.key];
      return [c.key, t.points !== null && t.max > 0 ? Math.round((t.points / t.max) * 1000) / 10 : null];
    })) as Record<BulletinColumn, number | null>;
    return { student, rows, totals, percent, place: {} as Record<BulletinColumn, number | null> };
  });

  const ranked = {} as Record<BulletinColumn, number>;
  for (const c of COLUMNS) {
    const scores = bulletins.map((b) => b.percent[c.key]).filter((v): v is number => v !== null);
    ranked[c.key] = scores.length;
    for (const b of bulletins) {
      const mine = b.percent[c.key];
      b.place[c.key] = mine === null ? null : 1 + scores.filter((v) => v > mine).length;
    }
  }
  return { subjects, bulletins, ranked, visible };
}

export function formatPoints(v: number | null) {
  if (v === null) return "";
  return Number.isInteger(v) ? String(v) : v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

export function formatPlace(place: number | null, of: number, gender?: string | null) {
  if (place === null) return "";
  const suffix = place === 1 ? (gender === "F" ? "re" : "er") : "e";
  return `${place}${suffix} / ${of}`;
}
