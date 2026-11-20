"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { cellText, normalizeHeader, parseDate } from "@/lib/excel-read";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, str, optStr, isUuid, isISODate, UserError, type ReportRow } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { findSimilarStudents, nameKey, nextStudentNumber, type StudentInput } from "@/lib/students";
import { raiseAlert } from "@/lib/alerts";
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
    birth_place: optStr(formData, "birth_place"),
    perm_number: optStr(formData, "perm_number")?.toUpperCase() ?? null,
    national_id: optStr(formData, "national_id")?.toUpperCase() ?? null,
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

  if (formData.get("not_duplicate") !== "1") {
    const similar = await findSimilarStudents(sql, school.id, s);
    if (similar.length) {
      const list = similar.map((x) => `${x.full} (${x.class_name ?? "sans classe"}, matricule ${x.student_number})`).join(", ");
      return {
        error: `Doublon possible : ${similar.length > 1 ? "ces élèves sont déjà inscrits" : "cet élève est déjà inscrit"} : ${list}. Vérifiez la liste des élèves avant de continuer.`,
        confirm: { name: "not_duplicate", label: "C'est bien un autre enfant (homonyme) : l'inscrire quand même." },
        at: Date.now(),
      };
    }
  }

  const id = await sql.begin(async (tx) => {
    const number = s.student_number ?? (await nextStudentNumber(tx, school.id, school.academic_year));
    const [dup] = await tx`select 1 from students where school_id = ${school.id} and student_number = ${number}`;
    if (dup) throw new UserError(`Le matricule ${number} est déjà utilisé.`);
    const [row] = await tx<{ id: string }[]>`
      insert into students (school_id, class_id, student_number, last_name, middle_name, first_name,
                            birth_date, gender, address, parent_name, parent_phone, enrolled_at,
                            birth_place, perm_number, national_id)
      values (${school.id}, ${s.class_id}, ${number}, ${s.last_name}, ${s.middle_name}, ${s.first_name},
              ${s.birth_date}, ${s.gender}, ${s.address}, ${s.parent_name}, ${s.parent_phone},
              ${s.enrolled_at ?? todayISO()}, ${s.birth_place}, ${s.perm_number}, ${s.national_id})
      returning id`;
    await audit({ schoolId: school.id, userId: user.id, action: "creation_eleve", table: "students", recordId: row.id }, tx);
    if (formData.get("not_duplicate") === "1") {
      await raiseAlert({
        schoolId: school.id, userId: user.id, kind: "doublon",
        title: `Élève inscrit malgré un homonyme : ${[s.last_name, s.middle_name, s.first_name].filter(Boolean).join(" ")}`,
        body: `Matricule ${number}. Vérifiez qu'il ne s'agit pas du même enfant inscrit deux fois.`,
        link: `/eleves/${row.id}`,
      }, tx);
    }
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
      birth_place = ${s.birth_place}, perm_number = ${s.perm_number}, national_id = ${s.national_id},
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
  "lieu de naissance": "birth_place",
  "n° perm": "perm_number",
  "n° id": "national_id",
  // Intitulés fréquents dans les fichiers des écoles.
  "n° matricule": "student_number",
  "numero matricule": "student_number",
  "nom de l'eleve": "last_name",
  "noms": "last_name",
  "post-nom": "middle_name",
  "post nom": "middle_name",
  "prenoms": "first_name",
  "genre": "gender",
  "sexe (m/f)": "gender",
  "date naissance": "birth_date",
  "ne(e) le": "birth_date",
  "niveau": "class_name",
  "classe actuelle": "class_name",
  "parent": "parent_name",
  "tuteur": "parent_name",
  "nom du tuteur": "parent_name",
  "telephone": "parent_phone",
  "tel": "parent_phone",
  "tel parent": "parent_phone",
  "telephone parent": "parent_phone",
  "contact": "parent_phone",
  "ne(e) a": "birth_place",
  "lieu naissance": "birth_place",
  "n° permanent": "perm_number",
  "numero permanent": "perm_number",
  "n perm": "perm_number",
  "num perm": "perm_number",
  "id": "national_id",
  "n id": "national_id",
  "numero id": "national_id",
  "n° identifiant": "national_id",
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

  const errors: ReportRow[] = [];
  let created = 0;
  await sql.begin(async (tx) => {
    const classes = new Map(
      (await tx<{ id: string; name: string }[]>`
        select id, name from classes where school_id = ${school.id} and academic_year = ${school.academic_year}`)
        .map((c) => [c.name.toLowerCase(), c.id]),
    );
    // Élèves déjà dans Scolar, par nom complet : un fichier envoyé deux fois ne crée pas de doublons.
    const existing = new Map(
      (await tx<{ student_number: string; last_name: string; middle_name: string | null; first_name: string | null }[]>`
        select student_number, last_name, middle_name, first_name from students where school_id = ${school.id} and status <> 'archived'`)
        .map((x) => [nameKey(x.last_name, x.middle_name, x.first_name), x.student_number]),
    );
    const seenNames = new Map<string, string>();
    const seenNumbers = new Map<string, string>();
    for (const r of rows) {
      const at = `Ligne ${r.line}`;
      if (!r.last_name) {
        errors.push({ where: at, problem: "Nom manquant", fix: "Remplissez la colonne Nom ou supprimez la ligne." });
        continue;
      }
      const key = nameKey(r.last_name, r.middle_name, r.first_name);
      const sameFile = seenNames.get(key);
      if (sameFile) {
        errors.push({ where: at, problem: `Même élève que la ligne ${sameFile}`, fix: "Supprimez la ligne en double. Un homonyme ? Inscrivez-le à la main." });
        continue;
      }
      const already = existing.get(key);
      if (already) {
        errors.push({ where: at, problem: `Déjà inscrit dans Scolar (matricule ${already})`, fix: "Rien à faire si c'est le même enfant. Un homonyme ? Inscrivez-le à la main." });
        continue;
      }
      if (r.student_number) {
        const n = r.student_number.trim().toLowerCase();
        const dupLine = seenNumbers.get(n);
        if (dupLine) {
          errors.push({ where: at, problem: `Matricule ${r.student_number} déjà utilisé ligne ${dupLine}`, fix: "Corrigez le matricule, ou videz la case : Scolar en donnera un." });
          continue;
        }
        seenNumbers.set(n, r.line);
      }
      const parsedBirth = r.birth_date ? parseDate(r.birth_date) : null;
      const birth = parsedBirth && isISODate(parsedBirth) ? parsedBirth : null;
      if (r.birth_date && !birth) {
        errors.push({ where: at, problem: `Date de naissance « ${r.birth_date} » illisible`, fix: "Écrivez-la comme 14/03/2014. L'élève n'a pas été importé." });
        continue;
      }
      let classId: string | null = null;
      if (r.class_name) {
        classId = classes.get(r.class_name.toLowerCase()) ?? null;
        if (!classId) {
          const [c] = await tx<{ id: string }[]>`
            insert into classes (school_id, name, academic_year, bulletin_regime)
            values (${school.id}, ${r.class_name}, ${school.academic_year},
                    case when ${r.class_name} ~* 'primaire' then 'trimestre' else 'semestre' end) returning id`;
          classId = c.id;
          classes.set(r.class_name.toLowerCase(), c.id);
        }
      }
      const g = r.gender?.toUpperCase().charAt(0);
      const number = r.student_number || (await nextStudentNumber(tx, school.id, school.academic_year));
      const [dup] = await tx`select 1 from students where school_id = ${school.id} and student_number = ${number}`;
      if (dup) {
        errors.push({ where: at, problem: `Matricule ${number} déjà utilisé par un autre élève`, fix: "Corrigez le matricule, ou videz la case : Scolar en donnera un." });
        continue;
      }
      await tx`
        insert into students (school_id, class_id, student_number, last_name, middle_name, first_name,
                              birth_date, gender, address, parent_name, parent_phone, birth_place, perm_number, national_id)
        values (${school.id}, ${classId}, ${number}, ${r.last_name.toUpperCase()}, ${r.middle_name?.toUpperCase() || null},
                ${r.first_name || null}, ${birth}, ${g === "M" || g === "F" ? g : null},
                ${r.address || null}, ${r.parent_name || null}, ${r.parent_phone || null},
                ${r.birth_place || null}, ${r.perm_number?.toUpperCase() || null}, ${r.national_id?.toUpperCase() || null})`;
      seenNames.set(key, r.line);
      created++;
    }
    await audit(
      { schoolId: school.id, userId: user.id, action: "import_eleves", table: "students", details: { created, errors: errors.length } },
      tx,
    );
    if (errors.length) {
      await raiseAlert({
        schoolId: school.id, userId: user.id, kind: "import",
        title: `Import des élèves : ${errors.length} ligne${errors.length > 1 ? "s" : ""} ignorée${errors.length > 1 ? "s" : ""} (${created} importé${created > 1 ? "s" : ""})`,
        body: errors.slice(0, 20).map((e) => `${e.where} : ${e.problem}`).join("\n"),
        link: "/eleves/import",
      }, tx);
    }
  });

  revalidatePath("/eleves");
  const summary = `${created} élève${created > 1 ? "s" : ""} importé${created > 1 ? "s" : ""}.`;
  if (errors.length) {
    return {
      error: `${summary} ${errors.length} ligne${errors.length > 1 ? "s" : ""} n'${errors.length > 1 ? "ont" : "a"} pas été importée${errors.length > 1 ? "s" : ""} : voir le détail ci-dessous. Corrigez-les dans votre fichier puis renvoyez-le : les élèves déjà importés seront reconnus et ignorés.`,
      report: errors,
      reportTitle: "Lignes non importées",
      at: Date.now(),
    };
  }
  return { success: summary };
});
