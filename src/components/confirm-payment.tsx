"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import type { ActionState } from "@/lib/actions";
import type { PaymentPreview } from "@/lib/payment-preview";
import { PendingContext } from "./forms";
import { Alert, Button, cx } from "./ui";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const WARNING_STYLES = {
  info: { box: "border-brand-200 bg-brand-50 text-brand-800", Icon: Info },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", Icon: AlertTriangle },
  danger: { box: "border-red-200 bg-red-50 text-red-800", Icon: ShieldAlert },
};

/**
 * Formulaire d'encaissement en deux temps : « Vérifier » montre un récapitulatif avec les mises en garde
 * (doublon possible, taux ou montant inhabituel…), puis « Confirmer » enregistre et ouvre le reçu.
 */
export function ConfirmPaymentForm({
  preview,
  create,
  children,
  className,
}: {
  preview: Action;
  create: Action;
  children: ReactNode;
  className?: string;
}) {
  const [checked, runPreview, previewing] = useActionState(preview, undefined);
  const [created, runCreate, creating] = useActionState(create, undefined);
  const lastForm = useRef<FormData | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // La fenêtre s'ouvre à chaque nouvelle vérification ; « Corriger » la ferme jusqu'à la suivante.
  const [closedAt, setClosedAt] = useState<number | undefined>(undefined);
  const [dup, setDup] = useState<{ at?: number; ok: boolean }>({ ok: false });
  const data = checked?.data as PaymentPreview | undefined;
  const open = Boolean(data) && checked?.at !== closedAt;
  const setOpen = (v: boolean) => !v && setClosedAt(checked?.at);
  const duplicateOk = dup.at === checked?.at && dup.ok;
  const setDuplicateOk = (ok: boolean) => setDup({ at: checked?.at, ok });

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const at = checked?.at;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !creating && setClosedAt(at);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, creating, checked?.at]);

  const needsDuplicate = Boolean(data?.duplicate || (created?.data as { needsDuplicateConfirm?: boolean } | undefined)?.needsDuplicateConfirm);

  const confirm = () => {
    if (!lastForm.current || creating) return;
    const fd = new FormData();
    lastForm.current.forEach((v, k) => fd.append(k, v));
    fd.set("confirmed", "1");
    if (duplicateOk) fd.set("confirm_duplicate", "1");
    startTransition(() => runCreate(fd));
  };

  return (
    <>
      <form
        className={className ?? "space-y-4"}
        onSubmit={(e) => {
          e.preventDefault();
          if (previewing) return;
          const fd = new FormData(e.currentTarget);
          lastForm.current = fd;
          startTransition(() => runPreview(fd));
        }}
      >
        {checked?.error && <div className="sm:col-span-3"><Alert kind="error">{checked.error}</Alert></div>}
        <PendingContext.Provider value={previewing}>{children}</PendingContext.Provider>
      </form>

      {open && data && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <button aria-label="Fermer" className="absolute inset-0 bg-ink/50" onClick={() => !creating && setOpen(false)} />
          <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <h2 id="confirm-title" className="text-lg font-semibold text-ink">Vérifiez avant d&apos;enregistrer</h2>
            <p className="mt-0.5 text-sm text-muted">Un reçu sera créé. Relisez le montant avec le parent.</p>

            <div className="mt-4 rounded-lg border border-line p-3">
              <div className="font-semibold text-ink">{data.student}</div>
              <div className="text-xs text-muted">{data.studentDetail}</div>
              <ul className="mt-3 divide-y divide-line text-sm">
                {data.lines.map((l, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      {l.fee}
                      {l.advance && <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">d&apos;avance</span>}
                      <span className="block text-xs text-muted">Après ce paiement : {l.after}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{l.amount}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2.5">
                <span className="text-sm font-medium text-green-800">Le parent remet</span>
                <span className="text-xl font-semibold tabular-nums text-green-800">{data.total}</span>
              </div>
              <dl className="mt-2 text-sm">
                {data.rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-1">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {data.warnings.length > 0 && (
              <ul className="mt-3 space-y-2">
                {data.warnings.map((w, i) => {
                  const { box, Icon } = WARNING_STYLES[w.level];
                  return (
                    <li key={i} className={cx("flex gap-2 rounded-lg border px-3 py-2 text-sm leading-snug", box)}>
                      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
                      <span>{w.text}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {needsDuplicate && (
              <label className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm">
                <input type="checkbox" className="mt-1" checked={duplicateOk} onChange={(e) => setDuplicateOk(e.target.checked)} />
                <span>Je confirme que le parent paie <strong>une deuxième fois</strong> : ce n&apos;est pas une erreur de saisie. Le directeur en sera averti.</span>
              </label>
            )}

            {created?.error && <div className="mt-3"><Alert kind="error">{created.error}</Alert></div>}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={creating}>Corriger</Button>
              <Button ref={confirmRef} variant="success" onClick={confirm} disabled={creating || (needsDuplicate && !duplicateOk)}>
                {creating ? "Enregistrement…" : "Confirmer et enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
