import { sql } from "./db";

export type Audience = "school" | "classes" | "student";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  event_date: Date | null;
  audience: Audience;
  class_ids: string[];
  student_id: string | null;
  created_at: Date;
  archived_at: Date | null;
};

export type AnnouncementRow = Announcement & {
  author: string | null;
  student_name: string | null;
  class_names: string[];
  recipients: number;
  reads: number;
};

/** Élèves actifs concernés par une annonce, avec de quoi joindre leur famille. */
export type Recipient = {
  id: string;
  last_name: string;
  middle_name: string | null;
  first_name: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_token: string;
  class_name: string | null;
  read_at: Date | null;
};

/** Condition SQL « l'élève s fait partie du public de l'annonce a ». */
const TARGETS = sql`(a.audience = 'school'
  or (a.audience = 'classes' and s.class_id = any(a.class_ids))
  or (a.audience = 'student' and s.id = a.student_id))`;

export async function listAnnouncements(schoolId: string, archived = false): Promise<AnnouncementRow[]> {
  return sql<AnnouncementRow[]>`
    select a.*, u.name as author,
           (select st.last_name || coalesce(' ' || st.first_name, '') from students st where st.id = a.student_id) as student_name,
           coalesce((select array_agg(c.name order by c.name) from classes c where c.id = any(a.class_ids)), '{}') as class_names,
           (select count(*) from students s where s.school_id = a.school_id and s.status = 'active' and ${TARGETS})::int as recipients,
           (select count(*) from announcement_reads r where r.announcement_id = a.id)::int as reads
    from announcements a left join users u on u.id = a.created_by
    where a.school_id = ${schoolId} and (a.archived_at is ${archived ? sql`not null` : sql`null`})
    order by a.created_at desc
    limit 100`;
}

export async function getAnnouncement(schoolId: string, id: string): Promise<AnnouncementRow | null> {
  const rows = await sql<AnnouncementRow[]>`
    select a.*, u.name as author,
           (select st.last_name || coalesce(' ' || st.first_name, '') from students st where st.id = a.student_id) as student_name,
           coalesce((select array_agg(c.name order by c.name) from classes c where c.id = any(a.class_ids)), '{}') as class_names,
           (select count(*) from students s where s.school_id = a.school_id and s.status = 'active' and ${TARGETS})::int as recipients,
           (select count(*) from announcement_reads r where r.announcement_id = a.id)::int as reads
    from announcements a left join users u on u.id = a.created_by
    where a.school_id = ${schoolId} and a.id = ${id}`;
  return rows[0] ?? null;
}

export async function recipientsOf(schoolId: string, id: string): Promise<Recipient[]> {
  return sql<Recipient[]>`
    select s.id, s.last_name, s.middle_name, s.first_name, s.parent_name, s.parent_phone, s.parent_token,
           c.name as class_name, r.read_at
    from announcements a
    join students s on s.school_id = a.school_id and s.status = 'active' and ${TARGETS}
    left join classes c on c.id = s.class_id
    left join announcement_reads r on r.announcement_id = a.id and r.student_id = s.id
    where a.school_id = ${schoolId} and a.id = ${id}
    order by c.name nulls last, s.last_name, s.first_name`;
}

/** Annonces visibles par la famille d'un élève, les plus récentes d'abord. */
export async function announcementsForStudent(student: { id: string; school_id: string }) {
  return sql<(Announcement & { read_at: Date | null })[]>`
    select a.*, r.read_at
    from announcements a
    join students s on s.id = ${student.id} and s.school_id = a.school_id
    left join announcement_reads r on r.announcement_id = a.id and r.student_id = s.id
    where a.school_id = ${student.school_id} and a.archived_at is null and ${TARGETS}
    order by a.created_at desc
    limit 20`;
}

export async function markRead(studentId: string, announcementIds: string[]) {
  if (announcementIds.length === 0) return;
  await sql`
    insert into announcement_reads (announcement_id, student_id)
    select unnest(${announcementIds}::uuid[]), ${studentId}
    on conflict do nothing`;
}

export function audienceLabel(a: Pick<AnnouncementRow, "audience" | "class_names" | "student_name">): string {
  if (a.audience === "school") return "Toute l'école";
  if (a.audience === "classes") return a.class_names.join(", ") || "Classes";
  return a.student_name ? `Famille de ${a.student_name}` : "Un élève";
}

/** Texte WhatsApp d'une annonce. Le lien personnel n'est ajouté que pour un envoi à une seule famille. */
export function announcementMessage(schoolName: string, a: Pick<Announcement, "title" | "body" | "event_date">, link?: string): string {
  const date = a.event_date
    ? `\nDate : ${new Date(a.event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`
    : "";
  const end = link ? `\n\nToutes les annonces et le solde de votre enfant : ${link}` : "\n\nRetrouvez cette annonce sur votre espace parent Scolar.";
  return `${schoolName}\n*${a.title}*${date}\n\n${a.body}${end}`;
}
