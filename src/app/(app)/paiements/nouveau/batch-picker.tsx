"use client";

import { useState } from "react";
import { Field, Input, cx } from "@/components/ui";
import { convertCents, emptyTotals, formatMoney, formatTotals, parseRate, type Currency } from "@/lib/money";

export type BatchFeeChoice = {
  id: string;
  name: string;
  /** Reste à payer en centimes (texte, pour passer du serveur au navigateur). */
  remaining: string;
  currency: Currency;
  due: string | null;
  dueLabel: string | null;
};

const CURRENCY_NAMES: Record<Currency, string> = { USD: "Dollars", CDF: "Francs" };

/**
 * Paiement de plusieurs frais en une fois, souvent d'avance (le trimestre, toute l'année).
 * Chaque frais coché est payé en entier ; le total s'affiche dans la devise du parent.
 */
export function BatchFeePicker({ fees, today, lastRate }: { fees: BatchFeeChoice[]; today: string; lastRate?: string }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(fees.filter((f) => !f.due || f.due <= today).map((f) => f.id)));
  const [paidIn, setPaidIn] = useState<Currency | "">("");
  const [rate, setRate] = useState(lastRate ?? "");
  const rateH = parseRate(rate);

  const chosen = fees.filter((f) => selected.has(f.id));
  const needsRate = paidIn !== "" && chosen.some((f) => f.currency !== paidIn);
  const total = emptyTotals();
  for (const f of chosen) {
    const cents = BigInt(f.remaining);
    if (paidIn === "" || paidIn === f.currency) total[f.currency] += cents;
    else if (rateH) total[paidIn] += convertCents(cents, f.currency, paidIn, rateH);
  }
  const upcoming = fees.filter((f) => f.due && f.due > today);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pick = (ids: string[]) => setSelected(new Set(ids));

  return (
    <>
      <fieldset className="sm:col-span-3">
        <legend className="mb-2 text-sm font-medium text-ink">Frais à payer en entier *</legend>
        <div className="mb-2 flex flex-wrap gap-2 text-sm">
          <button type="button" className="rounded-full border border-line px-3 py-1.5 hover:bg-gray-50" onClick={() => pick(fees.filter((f) => !f.due || f.due <= today).map((f) => f.id))}>
            Ce qui est déjà dû
          </button>
          {upcoming.length > 0 && (
            <button type="button" className="rounded-full border border-line px-3 py-1.5 hover:bg-gray-50"
              onClick={() => pick([...fees.filter((f) => !f.due || f.due <= today), ...upcoming.slice(0, 3)].map((f) => f.id))}>
              + les 3 prochains frais
            </button>
          )}
          <button type="button" className="rounded-full border border-line px-3 py-1.5 hover:bg-gray-50" onClick={() => pick(fees.map((f) => f.id))}>
            Toute l&apos;année
          </button>
        </div>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {fees.map((f) => {
            const ahead = f.due !== null && f.due > today;
            return (
              <li key={f.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 has-[:checked]:bg-brand-50/50">
                  <input type="checkbox" name="fee_ids" value={f.id} checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{f.name}</span>
                    <span className="block text-xs text-muted">
                      {f.dueLabel ? `Date limite : ${f.dueLabel}` : "Sans date limite"}
                      {ahead && <span className="ml-1.5 font-medium text-brand-700">· à venir</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(BigInt(f.remaining), f.currency)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-gray-700">Le parent paie en</legend>
        <input type="hidden" name="paid_currency" value={paidIn} />
        <div className="grid grid-cols-3 gap-2">
          {(["", "USD", "CDF"] as const).map((c) => (
            <button
              key={c || "same"}
              type="button"
              onClick={() => setPaidIn(c)}
              className={cx(
                "min-h-11 rounded-lg border px-2 text-sm sm:min-h-10",
                paidIn === c ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-gray-300 text-ink",
              )}
              aria-pressed={paidIn === c}
            >
              {c === "" ? "Même devise" : CURRENCY_NAMES[c]}
            </button>
          ))}
        </div>
      </fieldset>
      {needsRate ? (
        <Field label="Taux du jour *" hint="Francs pour 1 dollar">
          <Input name="exchange_rate" inputMode="decimal" required value={rate} placeholder="2850" onChange={(e) => setRate(e.target.value)} />
        </Field>
      ) : (
        <div className="hidden sm:block" />
      )}
      <div className="rounded-lg bg-green-50 px-3 py-2">
        <div className="text-xs text-green-800">Total à recevoir ({chosen.length} frais)</div>
        <div className="text-lg font-semibold tabular-nums text-green-800">
          {needsRate && !rateH ? "Saisissez le taux" : formatTotals(total)}
        </div>
      </div>
    </>
  );
}
