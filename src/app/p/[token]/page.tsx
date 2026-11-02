import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Download, MessageCircle, Phone } from "lucide-react";
import { sql } from "@/lib/db";
import { siblingsOf, studentByParentToken } from "@/lib/parent";
import { studentFeeLines, totalsFromLines } from "@/lib/finance";
import { PAYMENT_METHODS, formatDate, studentFullName, todayISO, type PaymentMethod } from "@/lib/labels";
import { formatMoney, type Currency } from "@/lib/money";
import { whatsAppLink } from "@/lib/phone";
import { Badge, MoneyLines, Wordmark, buttonClass, cx } from "@/components/ui";

export const metadata: Metadata = {
  title: "Espace parent",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ParentPage(props: PageProps<"/p/[token]">) {
  const { token } = await props.params;
  const s = await studentByParentToken(token);
  if (!s) notFound();

  const [lines, payments, siblings] = await Promise.all([
    studentFeeLines(s.school_id, s.id, s.academic_year),
    sql<{ id: string; receipt_number: string; payment_date: Date; amount_cents: bigint; currency: Currency;
          payment_method: PaymentMethod; fee_name: string }[]>`
      select p.id, p.receipt_number, p.payment_date, p.amount_cents, p.currency, p.payment_method, f.name as fee_name
      from payments p join fees f on f.id = p.fee_id
      where p.student_id = ${s.id} and p.school_id = ${s.school_id} and p.status = 'valid'
      order by p.payment_date desc, p.created_at desc`,
    siblingsOf(s),
  ]);
  const totals = totalsFromLines(lines);
  const allPaid = totals.remaining.USD + totals.remaining.CDF === BigInt(0);
  const today = todayISO();
  const isLate = (d: Date | null) => d !== null && d.toISOString().slice(0, 10) < today;
  const open = lines.filter((l) => l.remaining_cents > BigInt(0));
  const next = open[0];
  const name = studentFullName(s);
  const firstName = s.first_name ?? s.last_name;
  const ask = whatsAppLink(s.school_phone, `Bonjour, je suis le parent de ${name} (matricule ${s.student_number}). `);

  return (
    <div className="min-h-screen bg-canvas">
      {s.is_demo && (
        <div className="border-b border-brand-100 bg-brand-50 px-4 py-2.5 text-center text-sm text-ink">
          Démonstration : voici ce que voit un parent sur son téléphone.{" "}
          <a href="/demo" className="font-semibold text-brand-700 underline-offset-2 hover:underline">Retour à la démo</a>
        </div>
      )}
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          {s.has_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/p/${token}/logo`} alt="" className="h-10 w-10 rounded-md object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-sm font-semibold text-brand-700">
              {s.school_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{s.school_name}</div>
            <div className="truncate text-xs text-muted">{[s.school_address, s.school_city].filter(Boolean).join(", ") || `Année ${s.academic_year}`}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
        <div>
          <div className="text-[13px] text-muted">Espace parent · {s.academic_year}</div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-ink">{name}</h1>
          <div className="text-sm text-muted">{s.class_name ?? "Classe non attribuée"} · Matricule {s.student_number}</div>
        </div>

        <section className={cx("rounded-[var(--radius-card)] border p-5", allPaid ? "border-green-200 bg-green-50" : "border-line bg-white")}>
          {allPaid ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-green-700" />
              <div>
                <div className="text-lg font-semibold text-green-900">Tout est payé</div>
                <div className="text-sm text-green-800">Merci. Aucun montant n&apos;est dû pour {firstName} à ce jour.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="text-[13px] text-muted">Reste à payer</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-ink"><MoneyLines totals={totals.remaining} /></div>
              {next && (
                <div className={cx("mt-3 rounded-md px-3 py-2 text-sm", isLate(next.due_date) ? "bg-red-50 text-red-800" : "bg-canvas text-ink")}>
                  {isLate(next.due_date) ? "En retard : " : "Prochain paiement : "}
                  <strong>{next.name}</strong>, {formatMoney(next.remaining_cents, next.currency)}
                  {next.due_date && <> {isLate(next.due_date) ? "depuis le" : "avant le"} {formatDate(next.due_date)}</>}
                </div>
              )}
              <p className="mt-3 text-xs text-muted">Payez à la caisse de l&apos;école ou par Mobile Money, puis gardez le reçu. Il apparaît ici dès qu&apos;il est enregistré.</p>
            </>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] border border-line bg-white">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Frais de l&apos;année</h2>
          {lines.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">Aucun frais pour le moment.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((l) => {
                const done = l.remaining_cents <= BigInt(0);
                return (
                  <li key={l.fee_id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">{l.name}</div>
                      <div className="text-xs text-muted">
                        {l.due_date ? `Avant le ${formatDate(l.due_date)}` : "Sans date limite"}
                        {l.adjusted && l.amount_cents === BigInt(0) && " · Exempté"}
                        {l.adjusted && l.amount_cents > BigInt(0) && l.amount_cents < l.base_amount_cents && " · Réduction accordée"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm tabular-nums text-ink">{formatMoney(l.amount_cents, l.currency)}</div>
                      {done ? (
                        <Badge color="green">Payé</Badge>
                      ) : l.paid_cents > BigInt(0) ? (
                        <span className="text-xs text-amber-700">reste {formatMoney(l.remaining_cents, l.currency)}</span>
                      ) : (
                        <Badge color={isLate(l.due_date) ? "red" : "gray"}>{isLate(l.due_date) ? "En retard" : "À payer"}</Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] border border-line bg-white">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Reçus</h2>
          {payments.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">Aucun paiement enregistré.</p>
          ) : (
            <ul className="divide-y divide-line">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium tabular-nums text-ink">{formatMoney(p.amount_cents, p.currency)}</div>
                    <div className="truncate text-xs text-muted">{formatDate(p.payment_date)} · {p.fee_name} · {PAYMENT_METHODS[p.payment_method]}</div>
                  </div>
                  <a href={`/p/${token}/recu/${p.id}`} className={buttonClass("secondary", "shrink-0 gap-1.5")} target="_blank" rel="noopener">
                    <Download className="h-4 w-4" /> Reçu
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {siblings.length > 0 && (
          <section className="rounded-[var(--radius-card)] border border-line bg-white px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Vos autres enfants dans cette école</h2>
            <ul className="mt-2 space-y-1">
              {siblings.map((b) => (
                <li key={b.parent_token}>
                  <a href={`/p/${b.parent_token}`} className="text-sm text-brand-700 underline-offset-2 hover:underline">{studentFullName(b)}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {s.school_phone && (
          <section className="grid grid-cols-2 gap-2">
            <a href={`tel:${s.school_phone.replace(/\s/g, "")}`} className={buttonClass("secondary", "gap-1.5")}><Phone className="h-4 w-4" /> Appeler l&apos;école</a>
            <a href={ask} className={buttonClass("secondary", "gap-1.5")} target="_blank" rel="noopener"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
          </section>
        )}

        <p className="pt-2 text-center text-xs text-muted">
          Ce lien est personnel : ne le partagez qu&apos;avec la famille. Une question sur un montant ? Contactez l&apos;école.
        </p>
        <p className="text-center text-xs"><Link href="/aide/parent" className="font-medium text-brand-700 underline-offset-2 hover:underline">Comment utiliser cette page ?</Link></p>
        <div className="flex justify-center pb-4 opacity-60"><Wordmark className="scale-75" /></div>
      </main>
    </div>
  );
}
