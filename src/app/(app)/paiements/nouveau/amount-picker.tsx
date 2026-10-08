"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";

export type FeeChoice = { id: string; label: string; remaining: string; currency: string };

/** Choix du frais : le montant se pré-remplit avec le reste à payer, modifiable pour un paiement partiel. */
export function FeeAmountPicker({ fees, initialFee }: { fees: FeeChoice[]; initialFee?: string }) {
  const first = fees.find((f) => f.id === initialFee) ?? fees[0];
  const [feeId, setFeeId] = useState(first?.id ?? "");
  const [amount, setAmount] = useState(first?.remaining ?? "");
  const fee = fees.find((f) => f.id === feeId);

  return (
    <>
      <Field label="Frais payé *" className="sm:col-span-2">
        <Select
          name="fee_id"
          required
          value={feeId}
          onChange={(e) => {
            setFeeId(e.target.value);
            setAmount(fees.find((f) => f.id === e.target.value)?.remaining ?? "");
          }}
        >
          {fees.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={`Montant payé * ${fee ? `(${fee.currency})` : ""}`} hint={fee ? `Reste à payer : ${fee.remaining} ${fee.currency}` : undefined}>
        <Input name="amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-semibold" />
      </Field>
    </>
  );
}
