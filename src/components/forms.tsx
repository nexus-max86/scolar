"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/lib/actions";
import { Alert, Button, type ButtonVariant } from "./ui";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

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
