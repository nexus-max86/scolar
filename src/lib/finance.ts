import type postgres from "postgres";
import { sql } from "./db";
import { emptyTotals, type Currency, type Totals } from "./money";
import { todayISO } from "./labels";

export type FeeLine = {
  fee_id: string;
  name: string;
  category: string;
  currency: Currency;
  amount_cents: bigint;
  paid_cents: bigint;
  remaining_cents: bigint;
  due_date: Date | null;
  class_id: string | null;
};

/**
 * Frais d'un élève pour l'année : les frais de toute l'école, ceux de sa classe,
 * et ceux qu'il a déjà payés (même s'il a changé de classe ou si le frais est archivé).
 */
export async function studentFeeLines(schoolId: string, studentId: string, academicYear: string): Promise<FeeLine[]> {
  return sql<FeeLine[]>`
    with st as (select id, class_id from students where id = ${studentId} and school_id = ${schoolId}),
    paid as (
      select fee_id, sum(amount_cents)::bigint as paid
      from payments
      where school_id = ${schoolId} and student_id = ${studentId} and status = 'valid'
      group by fee_id
    )
    select f.id as fee_id, f.name, f.category, f.currency, f.amount_cents, f.due_date, f.class_id,
           coalesce(paid.paid, 0)::bigint as paid_cents,
           (f.amount_cents - coalesce(paid.paid, 0))::bigint as remaining_cents
    from fees f
    cross join st
    left join paid on paid.fee_id = f.id
    where f.school_id = ${schoolId} and f.academic_year = ${academicYear}
      and (paid.paid is not null
           or (not f.archived and (f.class_id is null or f.class_id = st.class_id)))
    order by f.due_date nulls last, f.created_at`;
}

export function totalsFromLines(lines: FeeLine[]) {
  const due = emptyTotals();
  const paid = emptyTotals();
  const remaining = emptyTotals();
  for (const l of lines) {
    due[l.currency] += l.amount_cents;
    paid[l.currency] += l.paid_cents;
    remaining[l.currency] += l.remaining_cents > BigInt(0) ? l.remaining_cents : BigInt(0);
  }
  return { due, paid, remaining };
}

export type PaymentStatus = "paid" | "partial" | "unpaid" | "none";

export function paymentStatus(due: Totals, paid: Totals, remaining: Totals): PaymentStatus {
  const totalDue = due.USD + due.CDF;
  if (totalDue === BigInt(0)) return "none";
  if (remaining.USD + remaining.CDF === BigInt(0)) return "paid";
  if (paid.USD + paid.CDF > BigInt(0)) return "partial";
  return "unpaid";
}

export const STATUS_LABELS: Record<PaymentStatus, { label: string; color: "green" | "orange" | "red" | "gray" }> = {
  paid: { label: "Payé", color: "green" },
  partial: { label: "Partiellement payé", color: "orange" },
  unpaid: { label: "Impayé", color: "red" },
  none: { label: "Aucun frais", color: "gray" },
};

export type StudentBalanceRow = {
  student_id: string;
  currency: Currency;
  due_cents: bigint;
  paid_cents: bigint;
  remaining_cents: bigint;
};

/**
 * Soldes de tous les élèves actifs (ou d'une classe), par devise.
 * overdueOnly : ne compte que les frais dont la date limite est passée.
 */
export async function schoolBalances(
  schoolId: string,
  academicYear: string,
  opts: { classId?: string | null; overdueOnly?: boolean } = {},
): Promise<StudentBalanceRow[]> {
  const classFilter = opts.classId ? sql`and class_id = ${opts.classId}` : sql``;
  const dueFilter = opts.overdueOnly ? sql`and f.due_date is not null and f.due_date < ${todayISO()}` : sql``;
  return sql<StudentBalanceRow[]>`
    with st as (
      select id, class_id from students where school_id = ${schoolId} and status = 'active' ${classFilter}
    ),
    paid as (
      select student_id, fee_id, sum(amount_cents)::bigint as paid
      from payments where school_id = ${schoolId} and status = 'valid'
      group by student_id, fee_id
    ),
    applicable as (
      select st.id as student_id, f.id as fee_id
      from st join fees f
        on f.school_id = ${schoolId} and f.academic_year = ${academicYear} and not f.archived
       and (f.class_id is null or f.class_id = st.class_id)
      union
      select paid.student_id, paid.fee_id from paid join st on st.id = paid.student_id
    )
    select a.student_id, f.currency,
           sum(f.amount_cents)::bigint as due_cents,
           sum(coalesce(p.paid, 0))::bigint as paid_cents,
           sum(greatest(f.amount_cents - coalesce(p.paid, 0), 0))::bigint as remaining_cents
    from applicable a
    join fees f on f.id = a.fee_id and f.academic_year = ${academicYear}
    left join paid p on p.student_id = a.student_id and p.fee_id = a.fee_id
    where true ${dueFilter}
    group by a.student_id, f.currency`;
}

export function totalsByStudent(rows: StudentBalanceRow[]) {
  const map = new Map<string, { due: Totals; paid: Totals; remaining: Totals }>();
  for (const r of rows) {
    let t = map.get(r.student_id);
    if (!t) {
      t = { due: emptyTotals(), paid: emptyTotals(), remaining: emptyTotals() };
      map.set(r.student_id, t);
    }
    t.due[r.currency] += r.due_cents;
    t.paid[r.currency] += r.paid_cents;
    t.remaining[r.currency] += r.remaining_cents;
  }
  return map;
}

export function sumTotals(rows: StudentBalanceRow[], key: "due_cents" | "paid_cents" | "remaining_cents"): Totals {
  const t = emptyTotals();
  for (const r of rows) t[r.currency] += r[key];
  return t;
}

export type Tx = postgres.TransactionSql;
