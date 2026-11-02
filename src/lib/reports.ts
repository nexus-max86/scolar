import { sql } from "./db";
import type { Currency } from "./money";
import type { PaymentMethod } from "./labels";

export type PaymentRow = {
  id: string;
  receipt_number: string;
  payment_date: Date;
  created_at: Date;
  amount_cents: bigint;
  currency: Currency;
  /** Ce qui est entré en caisse (diffère du montant crédité si le parent a payé dans l'autre devise). */
  cash_cents: bigint;
  cash_currency: Currency;
  payment_method: PaymentMethod;
  transaction_number: string | null;
  status: "valid" | "cancelled";
  fee_name: string;
  student_id: string;
  student_number: string;
  last_name: string;
  middle_name: string | null;
  first_name: string | null;
  class_name: string | null;
  agent: string;
  recorded_by: string;
};

export async function listPayments(
  schoolId: string,
  f: { from: string; to: string; method?: string; agent?: string; limit?: number },
): Promise<PaymentRow[]> {
  return sql<PaymentRow[]>`
    select p.id, p.receipt_number, p.payment_date, p.created_at, p.amount_cents, p.currency, p.payment_method,
           coalesce(p.received_cents, p.amount_cents) as cash_cents, coalesce(p.received_currency, p.currency) as cash_currency,
           p.transaction_number, p.status, p.recorded_by, f.name as fee_name,
           s.id as student_id, s.student_number, s.last_name, s.middle_name, s.first_name,
           c.name as class_name, u.name as agent
    from payments p
    join fees f on f.id = p.fee_id
    join students s on s.id = p.student_id
    left join classes c on c.id = s.class_id
    join users u on u.id = p.recorded_by
    where p.school_id = ${schoolId} and p.payment_date between ${f.from} and ${f.to}
      ${f.method ? sql`and p.payment_method = ${f.method}` : sql``}
      ${f.agent ? sql`and p.recorded_by = ${f.agent}` : sql``}
    order by p.payment_date desc, p.created_at desc
    ${f.limit ? sql`limit ${f.limit}` : sql``}`;
}

export function monthStartISO(today: string) {
  return today.slice(0, 8) + "01";
}
