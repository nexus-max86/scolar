"use client";

import { useState } from "react";
import { Field, Input, Select, cx } from "@/components/ui";
import { centsToInput, convertCents, formatMoney, formatRate, parseAmount, parseRate, type Currency } from "@/lib/money";

export type FeeChoice = { id: string; label: string; remaining: string; currency: string };

const CURRENCY_NAMES: Record<Currency, string> = { USD: "Dollars", CDF: "Francs" };

/**
 * Choix du frais : le montant se pré-remplit avec le reste à payer, modifiable pour un paiement partiel.
 * Le parent peut payer dans l'autre devise : le caissier saisit le taux du jour et voit le montant crédité.
 */
export function FeeAmountPicker({ fees, initialFee, lastRate }: { fees: FeeChoice[]; initialFee?: string; lastRate?: string }) {
  const first = fees.find((f) => f.id === initialFee) ?? fees[0];
  const [feeId, setFeeId] = useState(first?.id ?? "");
  const fee = fees.find((f) => f.id === feeId);
  const feeCurrency = (fee?.currency ?? "USD") as Currency;
  const [paidIn, setPaidIn] = useState<Currency>(feeCurrency);
  const [rate, setRate] = useState(lastRate ?? "");
  const [amount, setAmount] = useState(first?.remaining ?? "");

  const converted = paidIn !== feeCurrency;
  const rateH = parseRate(rate);
  const remainingCents = fee ? parseAmount(fee.remaining) : null;

  // Montant proposé : le reste à payer, converti dans la devise du parent si besoin.
  const suggest = (f: FeeChoice | undefined, cur: Currency, r: bigint | null) => {
    if (!f) return "";
    const rem = parseAmount(f.remaining);
    if (rem === null || cur === f.currency) return f.remaining;
    return r ? centsToInput(convertCents(rem, f.currency as Currency, cur, r)) : "";
  };

  const amountCents = parseAmount(amount);
  const credited = converted && amountCents && rateH ? convertCents(amountCents, paidIn, feeCurrency, rateH) : null;

  return (
    <>
      <Field label="Frais payé *" className="sm:col-span-2">
        <Select
          name="fee_id"
          required
          value={feeId}
          onChange={(e) => {
            const f = fees.find((x) => x.id === e.target.value);
            setFeeId(e.target.value);
            setPaidIn((f?.currency ?? "USD") as Currency);
            setAmount(f?.remaining ?? "");
          }}
        >
          {fees.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-gray-700">Le parent paie en</legend>
        <input type="hidden" name="paid_currency" value={paidIn} />
        <div className="grid grid-cols-2 gap-2">
          {(["USD", "CDF"] as Currency[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setPaidIn(c);
                setAmount(suggest(fee, c, rateH));
              }}
              className={cx(
                "min-h-11 rounded-lg border px-3 text-sm sm:min-h-10",
                paidIn === c ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-gray-300 text-ink",
              )}
              aria-pressed={paidIn === c}
            >
              {CURRENCY_NAMES[c]}
            </button>
          ))}
        </div>
      </fieldset>
      {converted && (
        <Field label="Taux du jour *" hint="Francs pour 1 dollar">
          <Input
            name="exchange_rate"
            inputMode="decimal"
            required
            value={rate}
            placeholder="2850"
            onChange={(e) => {
              setRate(e.target.value);
              const r = parseRate(e.target.value);
              if (r) setAmount(suggest(fee, paidIn, r));
            }}
          />
        </Field>
      )}
      <Field
        label={`Montant reçu * (${paidIn})`}
        hint={
          !fee ? undefined
            : converted
              ? credited !== null
                ? `Crédité sur le frais : ${formatMoney(credited, feeCurrency)} (reste ${formatMoney(remainingCents ?? 0, feeCurrency)}, taux ${formatRate(rateH!)})`
                : "Saisissez le taux pour voir le montant crédité."
              : `Reste à payer : ${fee.remaining} ${fee.currency}`
        }
        className={converted ? "sm:col-span-2" : undefined}
      >
        <Input name="amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-semibold" />
      </Field>
    </>
  );
}
