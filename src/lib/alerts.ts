import type postgres from "postgres";
import { sql as defaultSql } from "./db";

export type AlertKind = "import" | "doublon" | "montant" | "taux" | "date" | "annulation" | "erreur";

export const ALERT_KINDS: Record<AlertKind, { label: string; color: "red" | "orange" | "blue" | "gray" }> = {
  import: { label: "Import Excel", color: "orange" },
  doublon: { label: "Doublon", color: "red" },
  montant: { label: "Montant inhabituel", color: "orange" },
  taux: { label: "Taux inhabituel", color: "orange" },
  date: { label: "Date ancienne", color: "orange" },
  annulation: { label: "Paiement annulé", color: "gray" },
  erreur: { label: "Erreur", color: "red" },
};

/** Alerte pour le directeur, visible dans le menu « Alertes ». N'échoue jamais : une alerte ne doit pas bloquer la caisse. */
export async function raiseAlert(
  a: { schoolId: string; userId?: string | null; kind: AlertKind; title: string; body?: string | null; link?: string | null },
  tx: postgres.Sql | postgres.TransactionSql = defaultSql,
) {
  try {
    await tx`
      insert into alerts (school_id, kind, title, body, link, created_by)
      values (${a.schoolId}, ${a.kind}, ${a.title.slice(0, 200)}, ${a.body?.slice(0, 4000) ?? null}, ${a.link ?? null}, ${a.userId ?? null})`;
  } catch (err) {
    if (tx !== defaultSql) throw err; // dans une transaction, on laisse la transaction décider
    console.error("Alerte non enregistrée", err);
  }
}

export async function unreadAlertCount(schoolId: string): Promise<number> {
  const [{ n }] = await defaultSql<{ n: number }[]>`
    select count(*)::int as n from alerts where school_id = ${schoolId} and read_at is null`;
  return n;
}
