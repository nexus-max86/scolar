import { unstable_rethrow } from "next/navigation";
import { AccessError } from "./auth";

export type ActionState = { error?: string; success?: string; at?: number } | undefined;

/** Enveloppe une Server Action : erreurs connues → message simple, le reste est journalisé. */
export function formAction(
  fn: (prev: ActionState, formData: FormData) => Promise<ActionState>,
) {
  return async (prev: ActionState, formData: FormData): Promise<ActionState> => {
    try {
      return await fn(prev, formData);
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof AccessError || err instanceof UserError) return { error: err.message, at: Date.now() };
      console.error(err);
      return { error: "Une erreur inattendue est survenue. Réessayez dans un instant.", at: Date.now() };
    }
  };
}

/** Erreur dont le message peut être montré tel quel à l'utilisateur. */
export class UserError extends Error {}

export function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optStr(formData: FormData, key: string): string | null {
  return str(formData, key) || null;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
