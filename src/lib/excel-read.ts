import type ExcelJS from "exceljs";

/** Lecture des fichiers Excel envoyés par les écoles (en-têtes sans accents, dates JJ/MM/AAAA). */
export function normalizeHeader(h: string) {
  return h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value) return String(value.text).trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim();
  }
  return String(value).trim();
}

export function parseDate(text: string): string | null {
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

