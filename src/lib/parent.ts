import { sql } from "./db";

export type ParentStudent = {
  id: string;
  school_id: string;
  student_number: string;
  last_name: string;
  middle_name: string | null;
  first_name: string | null;
  parent_phone: string | null;
  parent_token: string;
  status: string;
  class_name: string | null;
  school_name: string;
  school_address: string | null;
  school_city: string | null;
  school_phone: string | null;
  academic_year: string;
  has_logo: boolean;
};

const TOKEN_RE = /^[0-9a-f]{32}$/;

/** Élève correspondant à un lien parent. Le lien est le seul secret : pas de compte à créer pour les parents. */
export async function studentByParentToken(token: string): Promise<ParentStudent | null> {
  if (!TOKEN_RE.test(token)) return null;
  const [s] = await sql<ParentStudent[]>`
    select s.id, s.school_id, s.student_number, s.last_name, s.middle_name, s.first_name, s.parent_phone,
           s.parent_token, s.status, c.name as class_name,
           sc.name as school_name, sc.address as school_address, sc.city as school_city, sc.phone as school_phone,
           sc.academic_year, sc.logo_data is not null as has_logo
    from students s
    join schools sc on sc.id = s.school_id and sc.status <> 'suspended'
    left join classes c on c.id = s.class_id
    where s.parent_token = ${token} and s.status <> 'archived'`;
  return s ?? null;
}

/** Frères et sœurs inscrits dans la même école avec le même numéro de parent. */
export async function siblingsOf(s: ParentStudent) {
  const digits = (s.parent_phone ?? "").replace(/\D/g, "").slice(-9);
  if (digits.length < 9) return [];
  return sql<{ last_name: string; middle_name: string | null; first_name: string | null; parent_token: string }[]>`
    select last_name, middle_name, first_name, parent_token from students
    where school_id = ${s.school_id} and id <> ${s.id} and status = 'active'
      and right(regexp_replace(coalesce(parent_phone, ''), '\\D', '', 'g'), 9) = ${digits}
    order by first_name, last_name`;
}
