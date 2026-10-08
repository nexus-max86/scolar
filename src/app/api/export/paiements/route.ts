import { isISODate } from "@/lib/actions";
import { centsToNumber, excelResponse } from "@/lib/excel";
import { PAYMENT_METHODS, studentFullName, todayISO } from "@/lib/labels";
import { listPayments, monthStartISO } from "@/lib/reports";
import { forbidden, routeSchoolUser } from "@/lib/route-auth";

export async function GET(req: Request) {
  const ctx = await routeSchoolUser();
  if (!ctx) return forbidden();
  const sp = new URL(req.url).searchParams;
  const today = todayISO();
  const from = isISODate(sp.get("du") ?? "") ? sp.get("du")! : monthStartISO(today);
  const to = isISODate(sp.get("au") ?? "") ? sp.get("au")! : today;
  const method = sp.get("moyen") ?? "";
  const payments = await listPayments(ctx.school.id, {
    from, to,
    method: method in PAYMENT_METHODS ? method : undefined,
    agent: ctx.user.role === "cashier" ? ctx.user.id : undefined,
  });
  return excelResponse(
    `paiements-${from}-au-${to}.xlsx`,
    "Paiements",
    [
      { header: "Date", key: "date", width: 12 },
      { header: "N° reçu", key: "receipt", width: 18 },
      { header: "Matricule", key: "num", width: 12 },
      { header: "Élève", key: "student", width: 30 },
      { header: "Classe", key: "class" },
      { header: "Frais", key: "fee", width: 28 },
      { header: "Montant", key: "amount", width: 12 },
      { header: "Devise", key: "currency", width: 8 },
      { header: "Moyen", key: "method" },
      { header: "N° transaction", key: "tx" },
      { header: "Agent", key: "agent" },
      { header: "Statut", key: "status", width: 10 },
    ],
    payments.map((p) => ({
      date: p.payment_date, receipt: p.receipt_number, num: p.student_number, student: studentFullName(p),
      class: p.class_name, fee: p.fee_name, amount: centsToNumber(p.amount_cents), currency: p.currency,
      method: PAYMENT_METHODS[p.payment_method], tx: p.transaction_number, agent: p.agent,
      status: p.status === "valid" ? "Valide" : "Annulé",
    })),
    `${ctx.school.name} — Paiements du ${from} au ${to}`,
  );
}
