import { sql } from "./db";
import { schoolBalances, totalsByStudent } from "./finance";
import type { Totals } from "./money";

export type UnpaidRow = {
  id: string;
  student_number: string;
  last_name: string;
  middle_name: string | null;
  first_name: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  class_name: string | null;
  remaining: Totals;
  paid: Totals;
};

export async function unpaidStudents(schoolId: string, academicYear: string, opts: { classId?: string; overdueOnly?: boolean }) {
  const balances = totalsByStudent(await schoolBalances(schoolId, academicYear, { classId: opts.classId, overdueOnly: opts.overdueOnly }));
  const ids = [...balances.entries()].filter(([, t]) => t.remaining.USD + t.remaining.CDF > BigInt(0)).map(([id]) => id);
  if (ids.length === 0) return [];
  const students = await sql<Omit<UnpaidRow, "remaining" | "paid">[]>`
    select s.id, s.student_number, s.last_name, s.middle_name, s.first_name, s.parent_name, s.parent_phone, c.name as class_name
    from students s left join classes c on c.id = s.class_id
    where s.school_id = ${schoolId} and s.id in ${sql(ids)}`;
  return students
    .map((s) => ({ ...s, remaining: balances.get(s.id)!.remaining, paid: balances.get(s.id)!.paid }))
    .sort((a, b) => (a.class_name ?? "").localeCompare(b.class_name ?? "") || a.last_name.localeCompare(b.last_name));
}
