"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, str, optStr, isUuid, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export const saveClass = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const id = str(formData, "id");
  const name = str(formData, "name");
  const section = optStr(formData, "section");
  if (!name) throw new UserError("Le nom de la classe est obligatoire.");
  try {
    if (id) {
      if (!isUuid(id)) throw new UserError("Classe introuvable.");
      const r = await sql`update classes set name = ${name}, section = ${section} where id = ${id} and school_id = ${school.id}`;
      if (r.count === 0) throw new UserError("Classe introuvable.");
      await audit({ schoolId: school.id, userId: user.id, action: "modification_classe", table: "classes", recordId: id });
    } else {
      const [c] = await sql<{ id: string }[]>`
        insert into classes (school_id, name, section, academic_year)
        values (${school.id}, ${name}, ${section}, ${school.academic_year}) returning id`;
      await audit({ schoolId: school.id, userId: user.id, action: "creation_classe", table: "classes", recordId: c.id });
    }
  } catch (err) {
    if (isUniqueViolation(err)) throw new UserError(`La classe « ${name} » existe déjà pour ${school.academic_year}.`);
    throw err;
  }
  revalidatePath("/classes");
  return { success: id ? "Classe modifiée." : `Classe « ${name} » créée.`, at: Date.now() };
});

export const deleteClass = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const id = str(formData, "id");
  if (!isUuid(id)) throw new UserError("Classe introuvable.");
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from students where class_id = ${id} and school_id = ${school.id}`;
  if (n > 0) throw new UserError("Impossible de supprimer une classe qui contient des élèves. Déplacez-les d'abord.");
  const [{ f }] = await sql<{ f: number }[]>`
    select count(*)::int as f from payments p join fees on fees.id = p.fee_id where fees.class_id = ${id}`;
  if (f > 0) throw new UserError("Des paiements sont liés aux frais de cette classe : elle ne peut pas être supprimée.");
  await sql`delete from classes where id = ${id} and school_id = ${school.id}`;
  await audit({ schoolId: school.id, userId: user.id, action: "suppression_classe", table: "classes", recordId: id });
  revalidatePath("/classes");
  return { success: "Classe supprimée." };
});
