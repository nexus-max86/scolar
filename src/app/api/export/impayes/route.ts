import { isUuid } from "@/lib/actions";
import { centsToNumber, excelResponse } from "@/lib/excel";
import { studentFullName } from "@/lib/labels";
import { unpaidStudents } from "@/lib/unpaid";
import { forbidden, routeSchoolUser } from "@/lib/route-auth";

export async function GET(req: Request) {
  const ctx = await routeSchoolUser();
  if (!ctx) return forbidden();
  const sp = new URL(req.url).searchParams;
  const classId = sp.get("classe") ?? "";
  const rows = await unpaidStudents(ctx.school.id, ctx.school.academic_year, {
    classId: isUuid(classId) ? classId : undefined,
    overdueOnly: sp.get("echus") === "1",
  });
  return excelResponse(
    `impayes-${ctx.school.academic_year}.xlsx`,
    "Impayés",
    [
      { header: "Matricule", key: "num", width: 12 },
      { header: "Élève", key: "name", width: 30 },
      { header: "Classe", key: "class" },
      { header: "Parent", key: "parent", width: 24 },
      { header: "Téléphone", key: "phone" },
      { header: "Reste USD", key: "usd", width: 12 },
      { header: "Reste CDF", key: "cdf", width: 14 },
    ],
    rows.map((r) => ({
      num: r.student_number, name: studentFullName(r), class: r.class_name, parent: r.parent_name, phone: r.parent_phone,
      usd: centsToNumber(r.remaining.USD), cdf: centsToNumber(r.remaining.CDF),
    })),
    `${ctx.school.name} — Impayés ${ctx.school.academic_year}`,
  );
}
