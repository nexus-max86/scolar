"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { cellText, normalizeHeader, parseDate } from "@/lib/excel-read";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, str, optStr, isUuid, isISODate, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { nextStudentNumber, type StudentInput } from "@/lib/students";
import { todayISO } from "@/lib/labels";

function readStudent(formData: FormData): StudentInput {
  const gender = str(formData, "gender");
  const birth = str(formData, "birth_date");
  const enrolled = str(formData, "enrolled_at");
  const classId = str(formData, "class_id");
  const input: StudentInput = {
    last_name: str(formData, "last_name").toUpperCase(),
    middle_name: optStr(formData, "middle_name")?.toUpperCase() ?? null,
    first_name: optStr(formData, "first_name"),
    birth_date: birth || null,
    gender: gender === "M" || gender === "F" ? gender : null,
    address: optStr(formData, "address"),
    parent_name: optStr(formData, "parent_name"),
    parent_phone: optStr(formData, "parent_phone"),
    class_id: classId || null,
    student_number: optStr(formData, "student_number"),
    enrolled_at: enrolled || null,
  };
  if (!input.last_name) throw new UserError("Le nom de l'élève est obligatoire.");
  if (input.birth_date && !isISODate(input.birth_date)) throw new UserError("La date de naissance n'est pas valide.");
  if (input.enrolled_at && !isISODate(input.enrolled_at)) throw new UserError("La date d'inscription n'est pas valide.");
  if (input.class_id && !isUuid(input.class_id)) throw new UserError("Classe invalide.");
  return input;
}

async function assertClass(schoolId: string, classId: string | null) {
  if (!classId) return;
  const [c] = await sql`select 1 from classes where id = ${classId} and school_id = ${schoolId}`;
  if (!c) throw new UserError("Cette classe n'existe pas dans votre école.");
}

export const createStudent = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess();
  const s = readStudent(formData);
  await assertClass(school.id, s.class_id);

  const id = await sql.begin(async (tx) => {
    const number = s.student_number ?? (await nextStudentNumber(tx, school.id, school.academic_year));
    const [dup] = await tx`select 1 from students where school_id = ${school.id} and student_number = ${number}`;
    if (dup) throw new UserError(`Le matricule ${number} est déjà utilisé.`);
    const [row] = await tx<{ id: string }[]>`
      insert into students (school_id, class_id, student_number, last_name, middle_name, first_name,
                            birth_date, gender, address, parent_name, parent_phone, enrolled_at)
      values (${school.id}, ${s.class_id}, ${number}, ${s.last_name}, ${s.middle_name}, ${s.first_name},
              ${s.birth_date}, ${s.gender}, ${s.address}, ${s.parent_name}, ${s.parent_phone},
              ${s.enrolled_at ?? todayISO()})
      returning id`;
    await audit({ schoolId: school.id, userId: user.id, action: "creation_eleve", table: "students", recordId: row.id }, tx);
    return row.id;
  });

  revalidatePath("/eleves");
  redirect(formData.get("then") === "payer" ? `/paiements/nouveau?eleve=${id}` : `/eleves/${id}?cree=1`);
});

export const updateStudent = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess();
  const id = str(formData, "id");
  if (!isUuid(id)) throw new UserError("Élève introuvable.");
  const s = readStudent(formData);
  await assertClass(school.id, s.class_id);
  if (!s.student_number) throw new UserError("Le matricule est obligatoire.");

  const [dup] = await sql`
    select 1 from students where school_id = ${school.id} and student_number = ${s.student_number} and id <> ${id}`;
  if (dup) throw new UserError(`Le matricule ${s.student_number} est déjà utilisé.`);

  const result = await sql`
    update students set class_id = ${s.class_id}, student_number = ${s.student_number},
      last_name = ${s.last_name}, middle_name = ${s.middle_name}, first_name = ${s.first_name},
      birth_date = ${s.birth_date}, gender = ${s.gender}, address = ${s.address},
      parent_name = ${s.parent_name}, parent_phone = ${s.parent_phone},
      enrolled_at = coalesce(${s.enrolled_at}::date, enrolled_at)
    where id = ${id} and school_id = ${school.id}`;
  if (result.count === 0) throw new UserError("Élève introuvable.");
  await audit({ schoolId: school.id, userId: user.id, action: "modification_eleve", table: "students", recordId: id });
  revalidatePath("/eleves");
  redirect(`/eleves/${id}?modifie=1`);
});

export const setStudentStatus = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!isUuid(id) || !["active", "transferred", "archived"].includes(status)) throw new UserError("Action invalide.");
  const result = await sql`update students set status = ${status} where id = ${id} and school_id = ${school.id}`;
  if (result.count === 0) throw new UserError("Élève introuvable.");
  await audit({ schoolId: school.id, userId: user.id, action: `statut_eleve_${status}`, table: "students", recordId: id });
  revalidatePath(`/eleves/${id}`);
  return { success: status === "active" ? "L'élève est de nouveau actif." : "Le statut de l'élève a été mis à jour." };
});

const IMPORT_COLUMNS: Record<string, keyof StudentInput | "class_name"> = {
  matricule: "student_number",
  nom: "last_name",
  postnom: "middle_name",
  prenom: "first_name",
  sexe: "gender",
  "date de naissance": "birth_date",
  classe: "class_name",
  "nom du parent": "parent_name",
  "telephone du parent": "parent_phone",
  adresse: "address",
};

/** Import Excel : crée les classes manquantes et ignore les lignes en erreur en les signalant. */
export const importStudents = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Choisissez un fichier Excel (.xlsx).");
  if (file.size > 3 * 1024 * 1024) throw new UserError("Fichier trop lourd (3 Mo maximum).");

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
  } catch {
    throw new UserError("Ce fichier n'est pas un fichier Excel .xlsx lisible. Utilisez le modèle proposé.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new UserError("Le fichier est vide.");

  const headerMap = new Map<number, string>();
  sheet.getRow(1).eachCell((cell, col) => {
    const key = IMPORT_COLUMNS[normalizeHeader(cellText(cell.value))];
    if (key) headerMap.set(col, key);
  });
  if (![...headerMap.values()].includes("last_name")) {
    throw new UserError("Colonne « Nom » introuvable sur la première ligne. Utilisez le modèle proposé.");
  }

  type Row = Record<string, string> & { line: string };
  const rows: Row[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const r: Row = { line: String(n) };
    headerMap.forEach((key, col) => (r[key] = cellText(row.getCell(col).value)));
    if (Object.entries(r).some(([k, v]) => k !== "line" && v)) rows.push(r);
  });
  if (rows.length === 0) throw new UserError("Aucun élève trouvé dans le fichier.");
  if (rows.length > 2000) throw new UserError("2 000 élèves maximum par import.");

  const errors: string[] = [];
  let created = 0;
  await sql.begin(async (tx) => {
    const classes = new Map(
      (await tx<{ id: string; name: string }[]>`
        select id, name from classes where school_id = ${school.id} and academic_year = ${school.academic_year}`)
        .map((c) => [c.name.toLowerCase(), c.id]),
    );
    for (const r of rows) {
      if (!r.last_name) {
        errors.push(`Ligne ${r.line} : nom manquant`);
        continue;
      }
      let classId: string | null = null;
      if (r.class_name) {
        classId = classes.get(r.class_name.toLowerCase()) ?? null;
        if (!classId) {
          const [c] = await tx<{ id: string }[]>`
            insert into classes (school_id, name, academic_year)
            values (${school.id}, ${r.class_name}, ${school.academic_year}) returning id`;
          classId = c.id;
          classes.set(r.class_name.toLowerCase(), c.id);
        }
      }
      const g = r.gender?.toUpperCase().charAt(0);
      const number = r.student_number || (await nextStudentNumber(tx, school.id, school.academic_year));
      const [dup] = await tx`select 1 from students where school_id = ${school.id} and student_number = ${number}`;
      if (dup) {
        errors.push(`Ligne ${r.line} : matricule ${number} déjà utilisé`);
        continue;
      }
      await tx`
        insert into students (school_id, class_id, student_number, last_name, middle_name, first_name,
                              birth_date, gender, address, parent_name, parent_phone)
        values (${school.id}, ${classId}, ${number}, ${r.last_name.toUpperCase()}, ${r.middle_name?.toUpperCase() || null},
                ${r.first_name || null}, ${parseDate(r.birth_date ?? "")}, ${g === "M" || g === "F" ? g : null},
                ${r.address || null}, ${r.parent_name || null}, ${r.parent_phone || null})`;
      created++;
    }
    await audit(
      { schoolId: school.id, userId: user.id, action: "import_eleves", table: "students", details: { created, errors: errors.length } },
      tx,
    );
  });

  revalidatePath("/eleves");
  const summary = `${created} élève${created > 1 ? "s" : ""} importé${created > 1 ? "s" : ""}.`;
  if (errors.length) {
    return { error: `${summary} ${errors.length} ligne(s) ignorée(s) : ${errors.slice(0, 10).join(" ; ")}${errors.length > 10 ? "…" : ""}` };
  }
  return { success: summary };
});
