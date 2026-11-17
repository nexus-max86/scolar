import type { PaymentWarning } from "./payments";

/** Ce que l'écran de confirmation affiche avant d'enregistrer un paiement (textes déjà formatés). */
export type PaymentPreview = {
  student: string;
  studentDetail: string;
  total: string;
  lines: { fee: string; amount: string; after: string; advance: boolean }[];
  rows: [string, string][];
  warnings: PaymentWarning[];
  duplicate: boolean;
};
