"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import type { ActionState, ReportRow } from "@/lib/actions";
import { Alert, Button, type ButtonVariant } from "./ui";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export const PendingContext = createContext(false);

/**
 * Formulaire relié à une Server Action, avec messages d'erreur ou de succès en français.
 * L'envoi passe par onSubmit (et non <form action>) pour que React ne vide pas les champs
 * quand le serveur renvoie une erreur : l'utilisateur corrige sans tout ressaisir.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirmMessage,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.success) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className ?? "space-y-4"}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const formData = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(formData));
      }}
    >
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      {state?.report && state.report.length > 0 && <ErrorReport title={state.reportTitle} rows={state.report} />}
      {state?.confirm && (
        <label key={state.at} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <input type="checkbox" name={state.confirm.name} value="1" required className="mt-1" />
          <span>{state.confirm.label}</span>
        </label>
      )}
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

export function SubmitButton({
  children,
  pendingText = "Enregistrement…",
  variant = "primary",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
  name?: string;
  value?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <Button type="submit" disabled={pending} variant={variant} className={className} name={name} value={value}>
      {pending ? pendingText : children}
    </Button>
  );
}

/** Petit formulaire à un bouton qui demande une confirmation (suppression, archivage…). */
export function ConfirmActionButton({
  action,
  fields,
  label,
  confirmMessage,
  variant = "danger",
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  confirmMessage: string;
  variant?: ButtonVariant;
}) {
  return (
    <ActionForm action={action} confirmMessage={confirmMessage} className="inline">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} pendingText="…">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

/** Rapport d'erreurs lisible : une ligne du fichier par ligne, avec la correction à faire. */
export function ErrorReport({ title, rows }: { title?: string; rows: ReportRow[] }) {
  const hasFix = rows.some((r) => r.fix);
  return (
    <div className="rounded-lg border border-red-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-2 text-sm font-medium text-red-800">
        <span>{title ?? "Lignes à corriger"}</span>
        <span className="tabular-nums">{rows.length}</span>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Où</th>
              <th className="px-3 py-2 font-medium">Problème</th>
              {hasFix && <th className="px-3 py-2 font-medium">Que faire</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 font-medium">{r.where}</td>
                <td className="px-3 py-2">{r.problem}</td>
                {hasFix && <td className="px-3 py-2 text-muted">{r.fix ?? ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
