import ExcelJS from "exceljs";

export type Column = { header: string; key: string; width?: number };

/** Construit un fichier .xlsx simple (en-tête en gras, colonnes figées) et la réponse HTTP associée. */
export async function excelResponse(
  filename: string,
  sheetName: string,
  columns: Column[],
  rows: Record<string, string | number | Date | null>[],
  title?: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ÉcoleFacile RDC";
  const ws = wb.addWorksheet(sheetName);
  let headerRow = 1;
  if (title) {
    ws.addRow([title]).font = { bold: true, size: 13 };
    ws.addRow([]);
    headerRow = 3;
  }
  ws.addRow(columns.map((c) => c.header)).font = { bold: true };
  columns.forEach((c, i) => (ws.getColumn(i + 1).width = c.width ?? 18));
  for (const r of rows) ws.addRow(columns.map((c) => r[c.key] ?? ""));
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Montant en centimes → nombre décimal pour Excel. */
export function centsToNumber(cents: bigint): number {
  return Number(cents) / 100;
}
