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
