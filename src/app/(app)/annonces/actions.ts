"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireWriteAccess } from "@/lib/auth";
import { formAction, isISODate, isUuid, optStr, str, UserError } from "@/lib/actions";
import { audit } from "@/lib/audit";

export const createAnnouncement = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const title = str(formData, "title");
  const body = str(formData, "body");
  const eventDate = optStr(formData, "event_date");
  const audience = str(formData, "audience");
  if (title.length < 3) throw new UserError("Donnez un titre à l'annonce (3 caractères minimum).");
  if (title.length > 120) throw new UserError("Le titre est trop long (120 caractères maximum).");
  if (!body) throw new UserError("Écrivez le texte de l'annonce.");
  if (body.length > 4000) throw new UserError("Le texte est trop long (4 000 caractères maximum).");
  if (eventDate && !isISODate(eventDate)) throw new UserError("Date invalide.");

  let classIds: string[] = [];
  let studentId: string | null = null;
  if (audience === "classes") {
    classIds = formData.getAll("class_ids").map(String).filter(isUuid);
    if (classIds.length === 0) throw new UserError("Choisissez au moins une classe.");
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from classes where school_id = ${school.id} and id = any(${classIds}::uuid[])`;
    if (n !== classIds.length) throw new UserError("Une des classes choisies n'existe pas.");
  } else if (audience === "student") {
    studentId = str(formData, "student_id");
    if (!isUuid(studentId)) throw new UserError("Élève introuvable.");
    const [s] = await sql`select 1 from students where id = ${studentId} and school_id = ${school.id}`;
    if (!s) throw new UserError("Élève introuvable.");
  } else if (audience !== "school") {
    throw new UserError("Choisissez à qui s'adresse l'annonce.");
  }

  const [row] = await sql<{ id: string }[]>`
    insert into announcements (school_id, title, body, event_date, audience, class_ids, student_id, created_by)
    values (${school.id}, ${title}, ${body}, ${eventDate}, ${audience}, ${classIds}::uuid[], ${studentId}, ${user.id})
    returning id`;
  await audit({ schoolId: school.id, userId: user.id, action: "publication_annonce", table: "announcements", recordId: row.id });
  revalidatePath("/annonces");
  redirect(`/annonces/${row.id}?publiee=1`);
});

export const archiveAnnouncement = formAction(async (_prev, formData) => {
  const { user, school } = await requireWriteAccess(["director"]);
  const id = str(formData, "id");
  if (!isUuid(id)) throw new UserError("Annonce introuvable.");
  const r = await sql`update announcements set archived_at = now() where id = ${id} and school_id = ${school.id} and archived_at is null`;
  if (r.count === 0) throw new UserError("Annonce introuvable.");
  await audit({ schoolId: school.id, userId: user.id, action: "retrait_annonce", table: "announcements", recordId: id });
  revalidatePath("/annonces");
  redirect("/annonces?retiree=1");
});
