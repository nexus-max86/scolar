import ExcelJS from "exceljs";
import { sql } from "@/lib/db";
import { PAYMENT_METHODS, studentFullName } from "@/lib/labels";
import { formatMoney, type Currency } from "@/lib/money";
import { forbidden, routeSchoolUser } from "@/lib/route-auth";

/**
 * Modèle pour reprendre les paiements reçus avant Scolar : une ligne par élève déjà remplie,
 * l'école complète le frais, le montant et la date (copier la ligne si l'élève a payé plusieurs fois).
 */
export async function GET() {
  const auth = await routeSchoolUser(["director"]);
  if (!auth) return forbidden();
  const { school } = auth;
  const [students, fees] = await Promise.all([
    sql<{ student_number: string; last_name: string; middle_name: string | null; first_name: string | null; class_name: string | null }[]>`
      select s.student_number, s.last_name, s.middle_name, s.first_name, c.name as class_name
      from students s left join classes c on c.id = s.class_id
      where s.school_id = ${school.id} and s.status = 'active'
      order by c.name nulls last, s.last_name, s.first_name`,
    sql<{ name: string; amount_cents: bigint; currency: Currency; class_name: string | null }[]>`
      select f.name, f.amount_cents, f.currency, c.name as class_name
      from fees f left join classes c on c.id = f.class_id
      where f.school_id = ${school.id} and f.academic_year = ${school.academic_year} and not f.archived
      order by f.due_date nulls last, f.created_at`,
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Scolar";
  const ws = wb.addWorksheet("Paiements");
  const headers = ["Matricule", "Élève", "Classe", "Frais", "Montant", "Date", "Moyen", "N° reçu papier"];
  ws.addRow(headers).font = { bold: true };
  [12, 32, 16, 30, 12, 13, 18, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (const s of students) ws.addRow([s.student_number, studentFullName(s), s.class_name ?? "", "", null, "", "", ""]);
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const ref = wb.addWorksheet("Frais");
  ref.addRow(["Frais (à recopier exactement)", "Montant", "Classe"]).font = { bold: true };
  ref.getColumn(1).width = 36;
  ref.getColumn(2).width = 14;
  ref.getColumn(3).width = 18;
  for (const f of fees) ref.addRow([f.name, formatMoney(f.amount_cents, f.currency), f.class_name ?? "Toutes"]);

  // Listes déroulantes : frais de l'année et moyens de paiement.
  const last = Math.max(students.length + 200, 500);
  const methods = `"${Object.values(PAYMENT_METHODS).join(",")}"`;
  for (let r = 2; r <= last; r++) {
    if (fees.length) {
      ws.getCell(r, 4).dataValidation = { type: "list", allowBlank: true, formulae: [`Frais!$A$2:$A$${fees.length + 1}`] };
    }
    if (methods.length < 250) ws.getCell(r, 7).dataValidation = { type: "list", allowBlank: true, formulae: [methods] };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reprise-paiements.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
