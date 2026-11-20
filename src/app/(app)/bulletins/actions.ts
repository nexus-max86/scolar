"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, isUuid, str, UserError, type ReportRow } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { DECISIONS, isExam, isPeriod, isRegime, periodLabel, periodMax, PRIMARY_SUBJECTS, SECONDARY_SUBJECTS, type PeriodCode, type Regime, type SubjectPreset } from "@/lib/bulletin";
import { studentFullName } from "@/lib/labels";

async function ownClass(schoolId: string, classId: string): Promise<Regime> {
  if (!isUuid(classId)) throw new UserError("Classe introuvable.");
  const [c] = await sql<{ bulletin_regime: Regime }[]>`select bulletin_regime from classes where id = ${classId} and school_id = ${schoolId}`;
  if (!c) throw new UserError("Classe introuvable.");
  return c.bulletin_regime;
}

/** Domaine et sous-groupe : texte libre, vide = pas de titre au bulletin. */
function readGroup(formData: FormData, key: string) {
  return str(formData, key).slice(0, 80) || null;
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
  const domain = readGroup(formData, "domain");
  const grp = readGroup(formData, "grp");
  const hasExam = formData.get("has_exam") !== null;
  const [dup] = await sql`select 1 from subjects where class_id = ${classId} and lower(name) = ${name.toLowerCase()}`;
  if (dup) throw new UserError(`Le cours « ${name} » existe déjà dans cette classe.`);
  await sql`
    insert into subjects (school_id, class_id, name, max_points, position, domain, grp, has_exam)
    values (${school.id}, ${classId}, ${name}, ${max},
            (select coalesce(max(position), 0) + 1 from subjects where class_id = ${classId}), ${domain}, ${grp}, ${hasExam})`;
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
  let list: SubjectPreset[];
  if (source === "primaire") list = PRIMARY_SUBJECTS;
  else if (source === "secondaire") list = SECONDARY_SUBJECTS;
  else if (isUuid(source)) {
    await ownClass(school.id, source);
    list = (await sql<{ name: string; max_points: number; domain: string | null; grp: string | null; has_exam: boolean }[]>`
      select name, max_points, domain, grp, has_exam from subjects where class_id = ${source} order by position, created_at`)
      .map((s) => [s.name, s.max_points, s.domain, s.grp, s.has_exam]);
    if (list.length === 0) throw new UserError("Cette classe n'a encore aucun cours.");
  } else throw new UserError("Choisissez une liste de cours.");

  let added = 0;
  await sql.begin(async (tx) => {
    const [{ pos }] = await tx<{ pos: number }[]>`select coalesce(max(position), 0)::int as pos from subjects where class_id = ${classId}`;
    for (const [i, [name, max, domain, grp, hasExam]] of list.entries()) {
      const r = await tx`
        insert into subjects (school_id, class_id, name, max_points, position, domain, grp, has_exam)
        values (${school.id}, ${classId}, ${name}, ${max}, ${pos + i + 1}, ${domain}, ${grp}, ${hasExam})
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
  const domain = readGroup(formData, "domain");
  const grp = readGroup(formData, "grp");
  const hasExam = formData.get("has_exam") !== null;
  const [over] = await sql<{ n: number }[]>`
    select count(*)::int as n from grades g where g.subject_id = ${id}
      and g.points > (case when g.period like 'ex%' then ${max * 2} else ${max} end)`;
  if (over && over.n > 0) throw new UserError(`${over.n} note(s) dépassent ce nouveau maximum. Corrigez-les d'abord.`);
  const r = await sql`update subjects set name = ${name}, max_points = ${max}, position = ${position},
                        domain = ${domain}, grp = ${grp}, has_exam = ${hasExam}
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
  const regime = await ownClass(school.id, classId);
  const period = str(formData, "period");
  if (!isPeriod(period, regime)) throw new UserError("Période invalide.");

  const [allSubjects, students] = await Promise.all([
    sql<{ id: string; name: string; max_points: number; has_exam: boolean }[]>`select id, name, max_points, has_exam from subjects where class_id = ${classId}`,
    sql<{ id: string; last_name: string; middle_name: string | null; first_name: string | null }[]>`
      select id, last_name, middle_name, first_name from students where class_id = ${classId} and school_id = ${school.id} and status = 'active'`,
  ]);
  // Pas d'examen pour certains cours (pratique professionnelle…) : on ignore leurs cases.
  const subjects = isExam(period) ? allSubjects.filter((sb) => sb.has_exam) : allSubjects;
  const errors: ReportRow[] = [];
  const marks: { student: string; application: string | null; conduct: string | null }[] = [];
  if (!isExam(period)) {
    for (const st of students) {
      if (formData.get(`app_${st.id}`) === null && formData.get(`cond_${st.id}`) === null) continue;
      marks.push({
        student: st.id,
        application: str(formData, `app_${st.id}`).toUpperCase().slice(0, 10) || null,
        conduct: str(formData, `cond_${st.id}`).toUpperCase().slice(0, 10) || null,
      });
    }
  }
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
    for (const m of marks) {
      await tx`
        insert into bulletin_marks (student_id, school_id, academic_year, period, application, conduct)
        values (${m.student}, ${school.id}, ${school.academic_year}, ${period}, ${m.application}, ${m.conduct})
        on conflict (student_id, academic_year, period)
        do update set application = excluded.application, conduct = excluded.conduct, updated_at = now()`;
    }
  });
  await audit({ schoolId: school.id, userId: user.id, action: "saisie_notes", table: "grades", details: { class: classId, period, count: upserts.length } });
  revalidatePath(`/bulletins/${classId}`);
  return { success: `Notes enregistrées pour : ${periodLabel(period, regime)} (${upserts.length} note${upserts.length > 1 ? "s" : ""}).`, at: Date.now() };
});

/** Décision de fin d'année et cours à repasser à l'examen de repêchage. */
export const saveRemarks = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director", "cashier"]);
  const classId = str(formData, "class_id");
  await ownClass(school.id, classId);
  const students = await sql<{ id: string }[]>`
    select id from students where class_id = ${classId} and school_id = ${school.id} and status = 'active'`;
  await sql.begin(async (tx) => {
    for (const st of students) {
      const raw = str(formData, `decision_${st.id}`);
      const decision = raw in DECISIONS ? raw : null;
      const repechage = str(formData, `repechage_${st.id}`).slice(0, 200) || null;
      await tx`
        insert into bulletin_remarks (student_id, school_id, academic_year, decision, repechage)
        values (${st.id}, ${school.id}, ${school.academic_year}, ${decision}, ${repechage})
        on conflict (student_id, academic_year)
        do update set decision = excluded.decision, repechage = excluded.repechage, updated_at = now()`;
    }
  });
  await audit({ schoolId: school.id, userId: user.id, action: "decisions_bulletin", table: "bulletin_remarks", details: { class: classId } });
  revalidatePath(`/bulletins/${classId}`);
  return { success: "Décisions enregistrées.", at: Date.now() };
});

/** Organisation du bulletin : trimestres ou semestres, titre imprimé et titulaire. */
export const saveBulletinLayout = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const classId = str(formData, "class_id");
  const before = await ownClass(school.id, classId);
  const regime = str(formData, "bulletin_regime");
  if (!isRegime(regime)) throw new UserError("Choisissez trimestres ou semestres.");
  if (regime !== before) {
    const [late] = await sql<{ n: number }[]>`
      select count(*)::int as n from grades g join subjects s on s.id = g.subject_id
      where s.class_id = ${classId} and g.period in ('p5', 'p6', 'ex3')`;
    if (regime === "semestre" && late.n > 0) {
      throw new UserError(`${late.n} note(s) du 3e trimestre existent déjà. Supprimez-les avant de passer aux semestres.`);
    }
  }
  const title = str(formData, "bulletin_title").slice(0, 120) || null;
  const titular = str(formData, "titular_name").slice(0, 80) || null;
  await sql`update classes set bulletin_regime = ${regime}, bulletin_title = ${title}, titular_name = ${titular},
              bulletin_period = case when ${regime} = 'semestre' and bulletin_period in ('p5', 'p6', 'ex3') then null else bulletin_period end
            where id = ${classId}`;
  await audit({ schoolId: school.id, userId: user.id, action: "modele_bulletin", table: "classes", recordId: classId, details: { regime } });
  revalidatePath(`/bulletins/${classId}`);
  return { success: "Modèle du bulletin enregistré.", at: Date.now() };
});

/** Période jusqu'à laquelle les parents voient le bulletin. */
export const saveBulletinSettings = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const classId = str(formData, "class_id");
  const regime = await ownClass(school.id, classId);
  const period = str(formData, "bulletin_period");
  if (period && !isPeriod(period, regime)) throw new UserError("Période invalide.");
  await sql`update classes set bulletin_period = ${period || null} where id = ${classId}`;
  await audit({ schoolId: school.id, userId: user.id, action: "publication_bulletin", table: "classes", recordId: classId, details: { period: period || null } });
  revalidatePath(`/bulletins/${classId}`);
  return {
    success: period
      ? `Publié : les parents voient le bulletin dans leur espace, jusqu'à « ${periodLabel(period as PeriodCode, regime)} ».`
      : "Bulletin masqué aux parents.",
    at: Date.now(),
  };
});
