import { sql } from "@/lib/db";
import { isUuid } from "@/lib/actions";
import { excelResponse, centsToNumber } from "@/lib/excel";
import { schoolBalances, totalsByStudent } from "@/lib/finance";
import { STUDENT_STATUS, studentFullName } from "@/lib/labels";
import { forbidden, routeSchoolUser } from "@/lib/route-auth";

export async function GET(req: Request) {
  const ctx = await routeSchoolUser();
  if (!ctx) return forbidden();
  const { school } = ctx;
  const url = new URL(req.url);
  const classId = url.searchParams.get("classe") ?? "";
  const statusParam = url.searchParams.get("statut") ?? "active";
  const status = statusParam in STUDENT_STATUS ? statusParam : "active";

  const students = await sql<{ id: string; student_number: string; last_name: string; middle_name: string | null;
    first_name: string | null; gender: string | null; birth_date: Date | null; class_name: string | null;
    parent_name: string | null; parent_phone: string | null; address: string | null }[]>`
    select s.id, s.student_number, s.last_name, s.middle_name, s.first_name, s.gender, s.birth_date,
           c.name as class_name, s.parent_name, s.parent_phone, s.address
    from students s left join classes c on c.id = s.class_id
    where s.school_id = ${school.id} and s.status = ${status}
      ${isUuid(classId) ? sql`and s.class_id = ${classId}` : sql``}
    order by c.name nulls last, s.last_name`;
  const balances = totalsByStudent(await schoolBalances(school.id, school.academic_year));

  return excelResponse(
    `eleves-${school.academic_year}.xlsx`,
    "Élèves",
    [
      { header: "Matricule", key: "num", width: 12 },
      { header: "Nom complet", key: "name", width: 32 },
      { header: "Sexe", key: "gender", width: 8 },
      { header: "Date de naissance", key: "birth" },
      { header: "Classe", key: "class" },
      { header: "Parent", key: "parent", width: 24 },
      { header: "Téléphone parent", key: "phone" },
      { header: "Adresse", key: "address", width: 30 },
      { header: "Reste à payer (USD)", key: "usd" },
      { header: "Reste à payer (CDF)", key: "cdf" },
    ],
    students.map((s) => {
      const t = balances.get(s.id);
      return {
        num: s.student_number, name: studentFullName(s), gender: s.gender, birth: s.birth_date,
        class: s.class_name, parent: s.parent_name, phone: s.parent_phone, address: s.address,
        usd: t ? centsToNumber(t.remaining.USD) : 0, cdf: t ? centsToNumber(t.remaining.CDF) : 0,
      };
    }),
    `${school.name} — Liste des élèves ${school.academic_year}`,
  );
}
