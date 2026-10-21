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
  optional: boolean;
  base_amount_cents: bigint;
  adjusted: boolean;
  adjust_reason: string | null;
};

/**
 * Frais d'un élève pour l'année. Un frais le concerne s'il est pour toute l'école ou pour sa classe
 * (sauf frais optionnel), s'il a un montant propre à l'élève (réduction, exemption, inscription
 * à un frais optionnel), ou s'il l'a déjà payé (même après un changement de classe).
 * Le montant dû est le montant propre à l'élève s'il existe, sinon celui du frais.
 */
export async function studentFeeLines(schoolId: string, studentId: string, academicYear: string): Promise<FeeLine[]> {
  return sql<FeeLine[]>`
    with st as (select id, class_id from students where id = ${studentId} and school_id = ${schoolId}),
    paid as (
      select fee_id, sum(amount_cents)::bigint as paid
      from payments
      where school_id = ${schoolId} and student_id = ${studentId} and status = 'valid'
      group by fee_id
    ),
    ov as (select fee_id, amount_cents, reason from student_fee_overrides where student_id = ${studentId})
    select f.id as fee_id, f.name, f.category, f.currency, f.due_date, f.class_id, f.optional,
           f.amount_cents as base_amount_cents,
           coalesce(ov.amount_cents, f.amount_cents) as amount_cents,
           ov.fee_id is not null as adjusted, ov.reason as adjust_reason,
           coalesce(paid.paid, 0)::bigint as paid_cents,
           (coalesce(ov.amount_cents, f.amount_cents) - coalesce(paid.paid, 0))::bigint as remaining_cents
    from fees f
    cross join st
    left join paid on paid.fee_id = f.id
    left join ov on ov.fee_id = f.id
    where f.school_id = ${schoolId} and f.academic_year = ${academicYear}
      and (paid.paid is not null or ov.fee_id is not null
           or (not f.archived and not f.optional and (f.class_id is null or f.class_id = st.class_id)))
    order by f.due_date nulls last, f.created_at`;
}

/** Frais optionnels de l'année auxquels l'élève peut être inscrit (transport, cantine…). */
export async function optionalFeesFor(schoolId: string, studentId: string, academicYear: string) {
  return sql<{ id: string; name: string; amount_cents: bigint; currency: Currency }[]>`
    select f.id, f.name, f.amount_cents, f.currency
    from fees f
    join students s on s.id = ${studentId} and s.school_id = ${schoolId}
    where f.school_id = ${schoolId} and f.academic_year = ${academicYear} and f.optional and not f.archived
      and (f.class_id is null or f.class_id = s.class_id)
      and not exists (select 1 from student_fee_overrides o where o.student_id = s.id and o.fee_id = f.id)
    order by f.due_date nulls last, f.name`;
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
    ov as (
      select student_id, fee_id, amount_cents from student_fee_overrides where school_id = ${schoolId}
    ),
    applicable as (
      select st.id as student_id, f.id as fee_id
      from st join fees f
        on f.school_id = ${schoolId} and f.academic_year = ${academicYear} and not f.archived and not f.optional
       and (f.class_id is null or f.class_id = st.class_id)
      union
      select paid.student_id, paid.fee_id from paid join st on st.id = paid.student_id
      union
      select ov.student_id, ov.fee_id from ov join st on st.id = ov.student_id
    )
    select a.student_id, f.currency,
           sum(coalesce(o.amount_cents, f.amount_cents))::bigint as due_cents,
           sum(coalesce(p.paid, 0))::bigint as paid_cents,
           sum(greatest(coalesce(o.amount_cents, f.amount_cents) - coalesce(p.paid, 0), 0))::bigint as remaining_cents
    from applicable a
    join fees f on f.id = a.fee_id and f.academic_year = ${academicYear}
    left join paid p on p.student_id = a.student_id and p.fee_id = a.fee_id
    left join ov o on o.student_id = a.student_id and o.fee_id = a.fee_id
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
