import { unstable_rethrow } from "next/navigation";
import { AccessError, getCurrentUser } from "./auth";
import { raiseAlert } from "./alerts";

/** Ligne d'un rapport d'erreurs (import Excel…) : où, quel problème, comment corriger. */
export type ReportRow = { where: string; problem: string; fix?: string };

export type ActionState =
  | {
      error?: string;
      success?: string;
      at?: number;
      report?: ReportRow[];
      reportTitle?: string;
      data?: unknown;
      /** Case à cocher à afficher pour passer outre un avertissement (ex. « ce n'est pas un doublon »). */
      confirm?: { name: string; label: string };
    }
  | undefined;

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
      await reportUnexpected(err);
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

/** Erreur technique imprévue : le directeur en est informé dans ses alertes, avec l'heure. */
async function reportUnexpected(err: unknown) {
  try {
    const user = await getCurrentUser();
    if (!user?.school_id) return;
    await raiseAlert({
      schoolId: user.school_id,
      userId: user.id,
      kind: "erreur",
      title: `Une opération de ${user.name} n'a pas abouti`,
      body: "Rien n'a été enregistré pour cette opération. Si le problème se répète, contactez l'équipe Scolar en indiquant l'heure de cette alerte." +
        (err instanceof Error && err.message ? ` (détail technique : ${err.message.slice(0, 200)})` : ""),
    });
  } catch {
    // On ne masque jamais l'erreur d'origine.
  }
}
