export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Administrateur plateforme",
  director: "Directeur",
  cashier: "Secrétaire / caissier",
  teacher: "Enseignant",
  parent: "Parent",
};

export const PAYMENT_METHODS = {
  especes: "Espèces",
  airtel_money: "Airtel Money",
  mpesa: "M-Pesa",
  orange_money: "Orange Money",
  virement: "Virement bancaire",
  autre: "Autre",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const FEE_CATEGORIES = {
  inscription: "Frais d'inscription",
  minerval: "Minerval",
  mensuel: "Frais mensuels",
  transport: "Transport",
  examen: "Frais d'examen",
  autre: "Autres frais",
} as const;
export type FeeCategory = keyof typeof FEE_CATEGORIES;

export const STUDENT_STATUS = {
  active: "Actif",
  transferred: "Transféré",
  archived: "Archivé",
} as const;

export const SCHOOL_STATUS: Record<string, string> = {
  trial: "Essai gratuit",
  active: "Actif",
  suspended: "Suspendu",
};

export const PLANS: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

export function studentFullName(s: {
  last_name: string;
  middle_name?: string | null;
  first_name?: string | null;
}): string {
  return [s.last_name, s.middle_name, s.first_name].filter(Boolean).join(" ");
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", { timeZone: "Africa/Kinshasa" });
}

/** Date du jour à Kinshasa au format AAAA-MM-JJ. */
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kinshasa" });
}
