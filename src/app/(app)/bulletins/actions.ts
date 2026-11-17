"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, isUuid, str, UserError, type ReportRow } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { isPeriod, periodLabel, periodMax, PRIMARY_SUBJECTS, SECONDARY_SUBJECTS, type PeriodCode } from "@/lib/bulletin";
import { studentFullName } from "@/lib/labels";

async function ownClass(schoolId: string, classId: string) {
  if (!isUuid(classId)) throw new UserError("Classe introuvable.");
  const [c] = await sql<{ id: string }[]>`select id from classes where id = ${classId} and school_id = ${schoolId}`;
  if (!c) throw new UserError("Classe introuvable.");
}

function readMax(text: string) {
  const n = Number(text.replace(",", "."));
  if (!Number.isInteger(n) || n < 1 || n > 200) throw new UserError("Le maximum par période doit être un nombre entier entre 1 et 200 (par exemple 10, 20 ou 40).");
  return n;
}

export const addSubject = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const classId = str(formData, "class_id");
  await ownClass(school.id, classId);
  const name = str(formData, "name");
  if (!name) throw new UserError("Indiquez le nom du cours.");
  const max = readMax(str(formData, "max_points"));
  const [dup] = await sql`select 1 from subjects where class_id = ${classId} and lower(name) = ${name.toLowerCase()}`;
  if (dup) throw new UserError(`Le cours « ${name} » existe déjà dans cette classe.`);
  await sql`
    insert into subjects (school_id, class_id, name, max_points, position)
    values (${school.id}, ${classId}, ${name}, ${max},
            (select coalesce(max(position), 0) + 1 from subjects where class_id = ${classId}))`;
  await audit({ schoolId: school.id, userId: user.id, action: "ajout_cours", table: "subjects", details: { name, max } });
  revalidatePath(`/bulletins/${classId}`);
  return { success: `Cours « ${name} » ajouté.`, at: Date.now() };
});

/** Ajoute d'un coup les cours habituels (primaire ou secondaire) ou recopie ceux d'une autre classe. */
export const addSubjectSet = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const classId = str(formData, "class_id");
  await ownClass(school.id, classId);
  const source = str(formData, "source");
  let list: [string, number][];
  if (source === "primaire") list = PRIMARY_SUBJECTS;
  else if (source === "secondaire") list = SECONDARY_SUBJECTS;
  else if (isUuid(source)) {
    await ownClass(school.id, source);
    list = (await sql<{ name: string; max_points: number }[]>`
      select name, max_points from subjects where class_id = ${source} order by position, created_at`).map((s) => [s.name, s.max_points]);
    if (list.length === 0) throw new UserError("Cette classe n'a encore aucun cours.");
  } else throw new UserError("Choisissez une liste de cours.");

  let added = 0;
  await sql.begin(async (tx) => {
    const [{ pos }] = await tx<{ pos: number }[]>`select coalesce(max(position), 0)::int as pos from subjects where class_id = ${classId}`;
    for (const [i, [name, max]] of list.entries()) {
      const r = await tx`
        insert into subjects (school_id, class_id, name, max_points, position)
        values (${school.id}, ${classId}, ${name}, ${max}, ${pos + i + 1})
        on conflict (class_id, name) do nothing`;
      added += r.count;
    }
  });
  await audit({ schoolId: school.id, userId: user.id, action: "ajout_cours", table: "subjects", details: { source, added } });
  revalidatePath(`/bulletins/${classId}`);
  return { success: added ? `${added} cours ajoutés. Modifiez les maxima si votre école en utilise d'autres.` : "Ces cours étaient déjà tous dans la classe.", at: Date.now() };
});

export const updateSubject = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const id = str(formData, "id");
  if (!isUuid(id)) throw new UserError("Cours introuvable.");
  const name = str(formData, "name");
  if (!name) throw new UserError("Indiquez le nom du cours.");
  const max = readMax(str(formData, "max_points"));
  const position = Number(str(formData, "position")) || 0;
  const [over] = await sql<{ n: number }[]>`
    select count(*)::int as n from grades g where g.subject_id = ${id}
      and g.points > (case when g.period in ('ex1', 'ex2') then ${max * 2} else ${max} end)`;
  if (over && over.n > 0) throw new UserError(`${over.n} note(s) dépassent ce nouveau maximum. Corrigez-les d'abord.`);
  const r = await sql`update subjects set name = ${name}, max_points = ${max}, position = ${position}
                      where id = ${id} and school_id = ${school.id} returning class_id`;
  if (r.count === 0) throw new UserError("Cours introuvable.");
  await audit({ schoolId: school.id, userId: user.id, action: "modification_cours", table: "subjects", recordId: id });
  revalidatePath(`/bulletins/${r[0].class_id}`);
  return { success: "Cours modifié.", at: Date.now() };
});

export const deleteSubject = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const id = str(formData, "id");
  if (!isUuid(id)) throw new UserError("Cours introuvable.");
  const r = await sql`delete from subjects where id = ${id} and school_id = ${school.id} returning class_id, name`;
  if (r.count === 0) throw new UserError("Cours introuvable.");
  await audit({ schoolId: school.id, userId: user.id, action: "suppression_cours", table: "subjects", recordId: id, details: { name: r[0].name } });
  revalidatePath(`/bulletins/${r[0].class_id}`);
  return { success: `Cours « ${r[0].name} » supprimé, avec ses notes.`, at: Date.now() };
});

/** Grille des points d'une période : une case par élève et par cours. Case vide = pas encore noté. */
export const saveGrades = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director", "cashier"]);
  const classId = str(formData, "class_id");
  await ownClass(school.id, classId);
  const period = str(formData, "period");
  if (!isPeriod(period)) throw new UserError("Période invalide.");

  const [subjects, students] = await Promise.all([
    sql<{ id: string; name: string; max_points: number }[]>`select id, name, max_points from subjects where class_id = ${classId}`,
    sql<{ id: string; last_name: string; middle_name: string | null; first_name: string | null }[]>`
      select id, last_name, middle_name, first_name from students where class_id = ${classId} and school_id = ${school.id} and status = 'active'`,
  ]);
  const errors: ReportRow[] = [];
  const upserts: { student: string; subject: string; points: string }[] = [];
  const deletes: { student: string; subject: string }[] = [];
  for (const st of students) {
    for (const sb of subjects) {
      const raw = formData.get(`g_${st.id}_${sb.id}`);
      if (raw === null) continue;
      const text = String(raw).trim().replace(",", ".");
      if (text === "") { deletes.push({ student: st.id, subject: sb.id }); continue; }
      const v = Number(text);
      const max = periodMax(sb.max_points, period);
      if (!/^\d+(\.\d{1,2})?$/.test(text) || Number.isNaN(v)) {
        errors.push({ where: studentFullName(st), problem: `${sb.name} : « ${raw} » n'est pas un nombre`, fix: "Écrivez par exemple 7 ou 7,5." });
      } else if (v > max) {
        errors.push({ where: studentFullName(st), problem: `${sb.name} : ${text} dépasse le maximum (${max})`, fix: `Saisissez une note entre 0 et ${max}.` });
      } else upserts.push({ student: st.id, subject: sb.id, points: v.toFixed(2) });
    }
  }
  if (errors.length) {
    return {
      error: "Rien n'a été enregistré : corrigez les notes signalées, elles sont restées dans la grille.",
      report: errors,
      reportTitle: "Notes à corriger",
      at: Date.now(),
    };
  }
  await sql.begin(async (tx) => {
    for (const u of upserts) {
      await tx`
        insert into grades (student_id, subject_id, school_id, period, points, updated_by)
        values (${u.student}, ${u.subject}, ${school.id}, ${period}, ${u.points}, ${user.id})
        on conflict (student_id, subject_id, period)
        do update set points = excluded.points, updated_by = excluded.updated_by, updated_at = now()
        where grades.points is distinct from excluded.points`;
    }
    for (const d of deletes) {
      await tx`delete from grades where student_id = ${d.student} and subject_id = ${d.subject} and period = ${period} and school_id = ${school.id}`;
    }
  });
  await audit({ schoolId: school.id, userId: user.id, action: "saisie_notes", table: "grades", details: { class: classId, period, count: upserts.length } });
  revalidatePath(`/bulletins/${classId}`);
  return { success: `Notes enregistrées pour : ${periodLabel(period)} (${upserts.length} note${upserts.length > 1 ? "s" : ""}).`, at: Date.now() };
});

/** Conduite, observation du titulaire et décision de fin d'année. */
export const saveRemarks = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director", "cashier"]);
  const classId = str(formData, "class_id");
  await ownClass(school.id, classId);
  const students = await sql<{ id: string }[]>`
    select id from students where class_id = ${classId} and school_id = ${school.id} and status = 'active'`;
  await sql.begin(async (tx) => {
    for (const st of students) {
      const conduct = str(formData, `conduct_${st.id}`).slice(0, 40) || null;
      const remark = str(formData, `remark_${st.id}`).slice(0, 300) || null;
      const decision = str(formData, `decision_${st.id}`).slice(0, 100) || null;
      await tx`
        insert into bulletin_remarks (student_id, school_id, academic_year, conduct, remark, decision)
        values (${st.id}, ${school.id}, ${school.academic_year}, ${conduct}, ${remark}, ${decision})
        on conflict (student_id, academic_year)
        do update set conduct = excluded.conduct, remark = excluded.remark, decision = excluded.decision, updated_at = now()`;
    }
  });
  await audit({ schoolId: school.id, userId: user.id, action: "appreciations_bulletin", table: "bulletin_remarks", details: { class: classId } });
  revalidatePath(`/bulletins/${classId}`);
  return { success: "Appréciations enregistrées.", at: Date.now() };
});

/** Titulaire de la classe et période jusqu'à laquelle les parents voient le bulletin. */
export const saveBulletinSettings = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const classId = str(formData, "class_id");
  await ownClass(school.id, classId);
  const period = str(formData, "bulletin_period");
  if (period && !isPeriod(period)) throw new UserError("Période invalide.");
  const titular = str(formData, "titular_name").slice(0, 80) || null;
  await sql`update classes set bulletin_period = ${period || null}, titular_name = ${titular} where id = ${classId}`;
  await audit({ schoolId: school.id, userId: user.id, action: "publication_bulletin", table: "classes", recordId: classId, details: { period: period || null } });
  revalidatePath(`/bulletins/${classId}`);
  return {
    success: period
      ? `Publié : les parents voient le bulletin dans leur espace, jusqu'à « ${periodLabel(period as PeriodCode)} ».`
      : "Bulletin masqué aux parents.",
    at: Date.now(),
  };
});
