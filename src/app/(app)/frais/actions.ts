"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, str, isUuid, isISODate, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { parseAmount } from "@/lib/money";
import { FEE_CATEGORIES } from "@/lib/labels";

const MONTHS = ["Septembre", "Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];

function readFee(formData: FormData) {
  const name = str(formData, "name");
  const category = str(formData, "category");
  const amount = parseAmount(str(formData, "amount"));
  const currency = str(formData, "currency");
  const dueDate = str(formData, "due_date") || null;
  const classId = str(formData, "class_id") || null;
  if (!(category in FEE_CATEGORIES)) throw new UserError("Choisissez un type de frais.");
  if (!amount || amount <= BigInt(0)) throw new UserError("Le montant doit être un nombre positif, par exemple 50 ou 25000.");
  if (currency !== "USD" && currency !== "CDF") throw new UserError("Choisissez la devise : USD ou CDF.");
  if (dueDate && !isISODate(dueDate)) throw new UserError("La date limite n'est pas valide.");
  if (classId && !isUuid(classId)) throw new UserError("Classe invalide.");
  return { name, category, amount, currency, dueDate, classId };
}

export const createFee = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const fee = readFee(formData);
  if (fee.classId) {
    const [c] = await sql`select 1 from classes where id = ${fee.classId} and school_id = ${school.id}`;
    if (!c) throw new UserError("Cette classe n'existe pas.");
  }
  const monthly = formData.get("monthly") === "on" && fee.category === "mensuel";
  const startYear = Number(school.academic_year.slice(0, 4));
  const items = monthly
    ? MONTHS.map((m, i) => {
        const year = i < 4 ? startYear : startYear + 1;
        const month = ((8 + i) % 12) + 1;
        return {
          name: `${fee.name || "Frais mensuels"} – ${m} ${year}`,
          due: `${year}-${String(month).padStart(2, "0")}-10`,
        };
      })
    : [{ name: fee.name || FEE_CATEGORIES[fee.category as keyof typeof FEE_CATEGORIES], due: fee.dueDate }];

  await sql.begin(async (tx) => {
    for (const item of items) {
      const [row] = await tx<{ id: string }[]>`
        insert into fees (school_id, name, category, amount_cents, currency, academic_year, due_date, class_id)
        values (${school.id}, ${item.name}, ${fee.category}, ${fee.amount.toString()}, ${fee.currency},
                ${school.academic_year}, ${item.due}, ${fee.classId}) returning id`;
      await audit({ schoolId: school.id, userId: user.id, action: "creation_frais", table: "fees", recordId: row.id }, tx);
    }
  });
  revalidatePath("/frais");
  return { success: items.length > 1 ? `${items.length} mensualités créées (septembre à juin).` : "Frais créé.", at: Date.now() };
});

export const updateFee = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const id = str(formData, "id");
  if (!isUuid(id)) throw new UserError("Frais introuvable.");
  const fee = readFee(formData);
  if (!fee.name) throw new UserError("Le nom du frais est obligatoire.");
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from payments where fee_id = ${id} and status = 'valid'`;
  const r = n > 0
    ? await sql`update fees set name = ${fee.name}, due_date = ${fee.dueDate} where id = ${id} and school_id = ${school.id}`
    : await sql`
        update fees set name = ${fee.name}, category = ${fee.category}, amount_cents = ${fee.amount.toString()},
          currency = ${fee.currency}, due_date = ${fee.dueDate}, class_id = ${fee.classId}
        where id = ${id} and school_id = ${school.id}`;
  if (r.count === 0) throw new UserError("Frais introuvable.");
  await audit({ schoolId: school.id, userId: user.id, action: "modification_frais", table: "fees", recordId: id });
  revalidatePath("/frais");
  return {
    success: n > 0
      ? "Nom et date limite modifiés. Le montant, la devise et la classe ne changent pas car des paiements existent déjà."
      : "Frais modifié.",
    at: Date.now(),
  };
});

export const removeFee = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const id = str(formData, "id");
  if (!isUuid(id)) throw new UserError("Frais introuvable.");
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from payments where fee_id = ${id}`;
  if (n > 0) {
    await sql`update fees set archived = true where id = ${id} and school_id = ${school.id}`;
    await audit({ schoolId: school.id, userId: user.id, action: "archivage_frais", table: "fees", recordId: id });
    revalidatePath("/frais");
    return { success: "Ce frais a déjà des paiements : il a été archivé (les paiements et reçus restent valables)." };
  }
  await sql`delete from fees where id = ${id} and school_id = ${school.id}`;
  await audit({ schoolId: school.id, userId: user.id, action: "suppression_frais", table: "fees", recordId: id });
  revalidatePath("/frais");
  return { success: "Frais supprimé." };
});
