import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { isUuid } from "@/lib/actions";
import { getReceipt } from "@/lib/payments";
import { PAYMENT_METHODS, formatDate, studentFullName } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { whatsAppLink } from "@/lib/phone";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PrintButton } from "@/components/print-button";
import { Alert, Card, Field, Input, LinkButton, buttonClass } from "@/components/ui";
import { cancelPayment } from "../../paiements/actions";

export const metadata = { title: "Reçu" };

export default async function ReceiptPage(props: PageProps<"/recus/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { user, school } = await requireSchoolUser();
  if (!isUuid(id)) notFound();
  const r = await getReceipt(school.id, id);
  if (!r) notFound();

  const name = studentFullName(r);
  const cancelled = r.status === "cancelled";
  const message =
    `${r.school_name}\nReçu N° ${r.receipt_number} du ${formatDate(r.payment_date)}\n` +
    `Élève : ${name} (${r.class_name ?? "—"})\n` +
    `Frais : ${r.fee_name}\nMontant payé : ${formatMoney(r.amount_cents, r.currency)} (${PAYMENT_METHODS[r.payment_method]})\n` +
    `Reste à payer (${r.currency}) : ${formatMoney(r.currency_remaining_cents, r.currency)}\nMerci.`;

  const rows: [string, string][] = [
    ["Date du paiement", formatDate(r.payment_date)],
    ["Élève", name],
    ["Matricule", r.student_number],
    ["Classe", r.class_name ?? "—"],
    ["Frais", r.fee_name],
    ["Montant du frais", formatMoney(r.fee_amount_cents, r.currency)],
    ["Moyen de paiement", PAYMENT_METHODS[r.payment_method]],
    ...(r.transaction_number ? [["N° de transaction", r.transaction_number] as [string, string]] : []),
    ["Reçu par", r.agent_name],
  ];

  return (
    <div className="mx-auto max-w-xl">
      {sp.nouveau && !cancelled && <div className="no-print mb-4"><Alert kind="success">Paiement enregistré. Le reçu est prêt.</Alert></div>}
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <a href={`/api/recus/${r.id}/pdf`} className={buttonClass("primary")} target="_blank" rel="noopener">Télécharger le PDF</a>
        <PrintButton />
        {!cancelled && (
          <a href={whatsAppLink(r.parent_phone, message)} target="_blank" rel="noopener" className={buttonClass("success")}>
            Envoyer par WhatsApp
          </a>
        )}
        <LinkButton href={`/eleves/${r.student_id}`} variant="ghost">Fiche de l&apos;élève</LinkButton>
      </div>

      <Card className="print-plain relative overflow-hidden">
        {cancelled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 text-6xl font-black text-red-600/25">ANNULÉ</span>
          </div>
        )}
        <div className="flex items-center gap-3 border-b border-line pb-3">
          {r.has_logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/logo/${r.school_id}`} alt="" className="h-14 w-14 object-contain" />
          )}
          <div>
            <div className="text-base font-semibold text-ink">{r.school_name}</div>
            <div className="text-xs text-muted">{[r.school_address, r.school_city].filter(Boolean).join(", ")}</div>
            <div className="text-xs text-muted">{[r.school_phone && `Tél. ${r.school_phone}`, r.school_email].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div className="my-3 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2">
          <span className="text-sm font-medium text-brand-700">Reçu de paiement</span>
          <span className="font-mono text-sm font-semibold">N° {r.receipt_number}</span>
        </div>
        <dl className="text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="my-3 flex items-center justify-between rounded-lg bg-green-50 px-3 py-3">
          <span className="text-sm font-medium text-green-800">Montant payé</span>
          <span className="text-2xl font-semibold tabular-nums text-green-800">{formatMoney(r.amount_cents, r.currency)}</span>
        </div>
        <dl className="text-sm">
          <div className="flex justify-between py-1">
            <dt className="text-muted">Reste à payer sur ce frais</dt>
            <dd className={r.fee_remaining_cents > BigInt(0) ? "font-semibold text-red-700" : "font-semibold text-green-700"}>
              {r.fee_remaining_cents > BigInt(0) ? formatMoney(r.fee_remaining_cents, r.currency) : "Soldé"}
            </dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-muted">Solde total restant ({r.currency})</dt>
            <dd className={r.currency_remaining_cents > BigInt(0) ? "font-semibold text-red-700" : "font-semibold text-green-700"}>
              {formatMoney(r.currency_remaining_cents, r.currency)}
            </dd>
          </div>
        </dl>
        {r.comment && <p className="mt-2 text-sm text-muted">Commentaire : {r.comment}</p>}
        {cancelled && <p className="mt-2 text-sm font-semibold text-red-700">Paiement annulé. Motif : {r.cancel_reason}</p>}
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{r.receipt_footer || "Merci pour votre paiement. Conservez ce reçu."}</p>
      </Card>

      {user.role === "director" && !cancelled && (
        <details className="no-print mt-4">
          <summary className="cursor-pointer text-sm font-medium text-red-700">Annuler ce paiement (erreur de saisie)</summary>
          <Card className="mt-2">
            <ActionForm action={cancelPayment} confirmMessage="Annuler définitivement ce paiement ? Le reçu restera visible avec la mention ANNULÉ.">
              <input type="hidden" name="id" value={r.id} />
              <Field label="Motif de l'annulation *"><Input name="reason" required minLength={3} /></Field>
              <SubmitButton variant="danger">Annuler le paiement</SubmitButton>
            </ActionForm>
          </Card>
        </details>
      )}
      <p className="no-print mt-4 text-center text-sm">
        <Link href="/paiements/nouveau" className="font-medium text-brand-600 hover:underline">+ Encaisser un autre paiement</Link>
      </p>
    </div>
  );
}
