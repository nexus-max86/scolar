export type Currency = "USD" | "CDF";
export const CURRENCIES: Currency[] = ["USD", "CDF"];

/** Convertit une saisie (« 25 000 », « 12,50 », « 12.5 ») en centimes. Retourne null si invalide. */
export function parseAmount(input: string): bigint | null {
  const cleaned = input.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole) * BigInt(100) + BigInt((frac + "00").slice(0, 2));
}

function groupThousands(n: string): string {
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Formate des centimes : USD → « 1 250,00 $ », CDF → « 25 000 FC ». Espaces simples (compatibles PDF). */
export function formatMoney(cents: bigint | number, currency: Currency | string): string {
  const value = BigInt(cents);
  const negative = value < BigInt(0);
  const abs = negative ? -value : value;
  const whole = groupThousands((abs / BigInt(100)).toString());
  const frac = (abs % BigInt(100)).toString().padStart(2, "0");
  const sign = negative ? "-" : "";
  if (currency === "CDF") {
    return `${sign}${whole}${frac === "00" ? "" : "," + frac} FC`;
  }
  return `${sign}${whole},${frac} $`;
}

/** Valeur décimale pour la saisie dans un formulaire (ex. 1250.5 → « 1250.50 »). */
export function centsToInput(cents: bigint | number): string {
  const value = BigInt(cents);
  const frac = (value % BigInt(100)).toString().padStart(2, "0");
  return `${value / BigInt(100)}${frac === "00" ? "" : "." + frac}`;
}

/** Totaux par devise, sans jamais mélanger USD et CDF. */
export type Totals = Record<Currency, bigint>;
export function emptyTotals(): Totals {
  return { USD: BigInt(0), CDF: BigInt(0) };
}

export function formatTotals(t: Totals): string {
  const parts = CURRENCIES.filter((c) => t[c] !== BigInt(0)).map((c) => formatMoney(t[c], c));
  return parts.length ? parts.join(" + ") : formatMoney(0, "USD");
}

/** Taux du jour saisi par le caissier (« 2 850 » francs pour 1 dollar) → centièmes de franc. Null si invalide. */
export function parseRate(input: string): bigint | null {
  const r = parseAmount(input);
  return r !== null && r >= BigInt(100) && r <= BigInt(100_000_00) ? r : null;
}

export function formatRate(rateHundredths: bigint | number | string): string {
  const cents = typeof rateHundredths === "string" ? BigInt(Math.round(Number(rateHundredths) * 100)) : BigInt(rateHundredths);
  return `${formatMoney(cents, "CDF")} pour 1 $`;
}

/**
 * Conversion au taux du jour, pour un frais payé dans l'autre devise.
 * Dollars → francs : arrondi au franc. Francs → dollars : arrondi au centime.
 */
export function convertCents(cents: bigint, from: Currency, to: Currency, rateHundredths: bigint): bigint {
  if (from === to) return cents;
  const h = BigInt(100);
  if (from === "USD") return ((cents * rateHundredths) / h + BigInt(50)) / h * h;
  return (cents * h * BigInt(2) + rateHundredths) / (BigInt(2) * rateHundredths);
}
