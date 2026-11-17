import type postgres from "postgres";
import { sql } from "./db";

export type ClassOption = { id: string; name: string; section: string | null };

export async function classOptions(schoolId: string, academicYear: string): Promise<ClassOption[]> {
  return sql<ClassOption[]>`
    select id, name, section from classes
    where school_id = ${schoolId} and academic_year = ${academicYear}
    order by name`;
}

export function classLabel(c: { name: string; section: string | null } | null | undefined) {
  if (!c) return "Sans classe";
  return c.section ? `${c.name} (${c.section})` : c.name;
}

/** Prochain matricule automatique : 2 chiffres de l'année + compteur, ex. 260042. */
export async function nextStudentNumber(tx: postgres.TransactionSql, schoolId: string, academicYear: string) {
  const [row] = await tx<{ student_counter: number }[]>`
    update schools set student_counter = student_counter + 1 where id = ${schoolId}
    returning student_counter`;
  return `${academicYear.slice(2, 4)}${String(row.student_counter).padStart(4, "0")}`;
}

export type StudentInput = {
  last_name: string;
  middle_name: string | null;
  first_name: string | null;
  birth_date: string | null;
  gender: "M" | "F" | null;
  address: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  class_id: string | null;
  student_number: string | null;
  enrolled_at: string | null;
};

/** Nom comparable : sans accents, sans espaces doubles, en minuscules (« MUKENDI  Élodie » = « mukendi elodie »). */
export function nameKey(...parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

export type SimilarStudent = { id: string; student_number: string; full: string; class_name: string | null; status: string };

/** Élèves de l'école qui portent le même nom complet (ou même nom + même date de naissance). */
export async function findSimilarStudents(
  tx: postgres.Sql | postgres.TransactionSql,
  schoolId: string,
  s: { last_name: string; middle_name: string | null; first_name: string | null; birth_date?: string | null },
  excludeId?: string,
): Promise<SimilarStudent[]> {
  const rows = await tx<{ id: string; student_number: string; last_name: string; middle_name: string | null; first_name: string | null;
                          birth_date: Date | null; class_name: string | null; status: string }[]>`
    select s.id, s.student_number, s.last_name, s.middle_name, s.first_name, s.birth_date, s.status, c.name as class_name
    from students s left join classes c on c.id = s.class_id
    where s.school_id = ${schoolId} and lower(s.last_name) = ${s.last_name.trim().toLowerCase()} and s.status <> 'archived'
      ${excludeId ? tx`and s.id <> ${excludeId}` : tx``}`;
  const key = nameKey(s.last_name, s.middle_name, s.first_name);
  return rows
    .filter((r) => nameKey(r.last_name, r.middle_name, r.first_name) === key ||
      (s.birth_date && r.birth_date && new Date(r.birth_date).toISOString().slice(0, 10) === s.birth_date))
    .map((r) => ({ id: r.id, student_number: r.student_number, full: [r.last_name, r.middle_name, r.first_name].filter(Boolean).join(" "), class_name: r.class_name, status: r.status }));
}
