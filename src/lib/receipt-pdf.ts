import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMoney } from "./money";
import { PAYMENT_METHODS, formatDate, studentFullName } from "./labels";
import { receivedLabel, type Receipt } from "./payments";

export type ReceiptFormat = "a4" | "ticket58" | "ticket80";

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Les polices standard du PDF n'acceptent que le jeu WinAnsi : on remplace le reste. */
function clean(text: string) {
  return Array.from(text.normalize("NFC"))
    .map((ch) => (ch.charCodeAt(0) <= 255 || WIN_ANSI_EXTRA.includes(ch) ? ch : "?"))
    .join("")
    .replace(/[  ]/g, " ");
}

const BLUE = rgb(0.114, 0.306, 0.847);
const GRAY = rgb(0.42, 0.45, 0.5);
const DARK = rgb(0.07, 0.09, 0.15);

export async function receiptPdf(
  r: Receipt,
  logo: { data: Buffer; mime: string } | null,
  format: ReceiptFormat = "a4",
): Promise<Uint8Array> {
  if (format !== "a4") return ticketPdf(r, format === "ticket58" ? 58 : 80);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Reçu ${r.receipt_number}`);
  pdf.setProducer("Scolar");
  const page = pdf.addPage([420, 595]); // A5
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 32;
  let y = height - margin;

  const text = (p: PDFPage, s: string, x: number, yy: number, size = 10, f: PDFFont = font, color = DARK) =>
    p.drawText(clean(s), { x, y: yy, size, font: f, color });
  const right = (s: string, yy: number, size = 10, f: PDFFont = font, color = DARK) =>
    text(page, s, width - margin - f.widthOfTextAtSize(clean(s), size), yy, size, f, color);

  // En-tête : logo + coordonnées de l'école
  let textX = margin;
  if (logo) {
    try {
      const img = logo.mime === "image/png" ? await pdf.embedPng(logo.data) : logo.mime === "image/jpeg" ? await pdf.embedJpg(logo.data) : null;
      if (img) {
        const scale = Math.min(52 / img.width, 52 / img.height);
        page.drawImage(img, { x: margin, y: y - 52, width: img.width * scale, height: img.height * scale });
        textX = margin + 62;
      }
    } catch {
      // Logo illisible : le reçu reste valable sans lui.
    }
  }
  text(page, r.school_name, textX, y - 14, 13, bold, BLUE);
  const contact = [r.school_address, r.school_city].filter(Boolean).join(", ");
  if (contact) text(page, contact, textX, y - 29, 9, font, GRAY);
  const contact2 = [r.school_phone && `Tél. ${r.school_phone}`, r.school_email].filter(Boolean).join(" · ");
  if (contact2) text(page, contact2, textX, y - 41, 9, font, GRAY);
  y -= 70;

  page.drawRectangle({ x: margin, y: y - 30, width: width - 2 * margin, height: 30, color: rgb(0.937, 0.965, 1) });
  text(page, "REÇU DE PAIEMENT", margin + 10, y - 20, 12, bold, BLUE);
  right(`N° ${r.receipt_number}`, y - 20, 11, bold);
  y -= 50;

  const row = (label: string, value: string, opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
    text(page, label, margin, y, 10, font, GRAY);
    right(value, y, 10, opts.bold ? bold : font, opts.color ?? DARK);
    y -= 18;
  };

  row("Date du paiement", formatDate(r.payment_date));
  row("Élève", studentFullName(r), { bold: true });
  row("Matricule", r.student_number);
  row("Code élève", r.scolar_code);
  row("Classe", r.class_name ?? "—");
  row("Année scolaire", r.academic_year);
  y -= 4;
  page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: width - margin, y: y + 8 }, thickness: 0.5, color: GRAY });
  y -= 8;
  row("Frais", r.fee_name);
  row("Montant du frais", formatMoney(r.fee_amount_cents, r.currency));
  row("Moyen de paiement", PAYMENT_METHODS[r.payment_method]);
  if (r.transaction_number) row("N° de transaction", r.transaction_number);
  const received = receivedLabel(r);
  if (received) row("Payé en", received);
  y -= 4;

  page.drawRectangle({ x: margin, y: y - 34, width: width - 2 * margin, height: 40, color: rgb(0.925, 0.992, 0.953) });
  text(page, "MONTANT PAYÉ", margin + 10, y - 19, 11, bold, rgb(0.08, 0.5, 0.24));
  right(formatMoney(r.amount_cents, r.currency), y - 20, 16, bold, rgb(0.08, 0.5, 0.24));
  y -= 56;

  const red = rgb(0.73, 0.11, 0.11);
  const green = rgb(0.08, 0.5, 0.24);
  row("Reste à payer sur ce frais", r.fee_remaining_cents > BigInt(0) ? formatMoney(r.fee_remaining_cents, r.currency) : "Soldé", {
    bold: true, color: r.fee_remaining_cents > BigInt(0) ? red : green,
  });
  row(`Solde total restant (${r.currency})`, formatMoney(r.currency_remaining_cents, r.currency), {
    bold: true, color: r.currency_remaining_cents > BigInt(0) ? red : green,
  });
  if (r.comment) row("Commentaire", r.comment.slice(0, 60));
  y -= 10;
  text(page, `Reçu par : ${r.agent_name}`, margin, y, 10);
  text(page, "Signature et cachet", width - margin - 120, y, 10, font, GRAY);
  page.drawLine({ start: { x: width - margin - 120, y: y - 40 }, end: { x: width - margin, y: y - 40 }, thickness: 0.5, color: GRAY });

  if (r.status === "cancelled") {
    page.drawText("ANNULÉ", { x: 90, y: 250, size: 72, font: bold, color: rgb(0.86, 0.15, 0.15), opacity: 0.35, rotate: degrees(30) });
    text(page, clean(`Motif : ${r.cancel_reason ?? ""}`), margin, 70, 9, font, red);
  }

  const footer = r.receipt_footer || "Merci pour votre paiement. Conservez ce reçu.";
  text(page, footer.slice(0, 90), margin, 48, 8, font, GRAY);
  text(page, `Émis le ${formatDate(r.created_at)} via Scolar`, margin, 36, 7, font, GRAY);

  return pdf.save();
}

const MM = 72 / 25.4;

/**
 * Reçu pour petite imprimante thermique (58 ou 80 mm) : une seule colonne, page à la hauteur du contenu.
 * S'imprime depuis le téléphone (application d'impression Bluetooth) ou l'ordinateur, à 100 %.
 */
async function ticketPdf(r: Receipt, widthMm: 58 | 80): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Reçu ${r.receipt_number}`);
  pdf.setProducer("Scolar");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = widthMm * MM;
  const margin = widthMm === 58 ? 6 : 9;
  const inner = width - 2 * margin;
  const base = widthMm === 58 ? 7.5 : 9;
  const black = rgb(0, 0, 0);

  type Item =
    | { kind: "text"; s: string; size: number; f: PDFFont; align: "left" | "center" | "right" }
    | { kind: "pair"; label: string; value: string; size: number; f: PDFFont }
    | { kind: "rule" }
    | { kind: "space"; h: number };
  const items: Item[] = [];

  const wrap = (s: string, size: number, f: PDFFont) => {
    const words = clean(s).split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) <= inner || !cur) cur = next;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const line = (s: string, size = base, f = font, align: "left" | "center" | "right" = "left") =>
    wrap(s, size, f).forEach((l) => items.push({ kind: "text", s: l, size, f, align }));
  // Libellé à gauche, valeur à droite ; si la valeur est trop longue, elle passe à la ligne suivante.
  const pair = (label: string, value: string, f = font, size = base) => {
    const lw = font.widthOfTextAtSize(clean(label), size) + 6;
    if (lw + f.widthOfTextAtSize(clean(value), size) <= inner) items.push({ kind: "pair", label, value, size, f });
    else {
      line(label, size, font);
      line(value, size, f, "right");
    }
  };
  const rule = () => items.push({ kind: "rule" });

  line(r.school_name, base + 2, bold, "center");
  const contact = [r.school_address, r.school_city].filter(Boolean).join(", ");
  if (contact) line(contact, base - 1, font, "center");
  if (r.school_phone) line(`Tél. ${r.school_phone}`, base - 1, font, "center");
  rule();
  line("REÇU DE PAIEMENT", base + 1, bold, "center");
  line(`N° ${r.receipt_number}`, base, bold, "center");
  line(formatDate(r.payment_date), base, font, "center");
  rule();
  pair("Élève", studentFullName(r), bold);
  pair("Matricule", r.student_number);
  pair("Code élève", r.scolar_code);
  pair("Classe", r.class_name ?? "-");
  pair("Frais", r.fee_name);
  pair("Moyen", PAYMENT_METHODS[r.payment_method]);
  if (r.transaction_number) pair("Transaction", r.transaction_number);
  const received = receivedLabel(r);
  if (received) pair("Payé en", received);
  rule();
  line("MONTANT PAYÉ", base, bold, "center");
  line(formatMoney(r.amount_cents, r.currency), base + 6, bold, "center");
  items.push({ kind: "space", h: 3 });
  pair("Reste sur ce frais", r.fee_remaining_cents > BigInt(0) ? formatMoney(r.fee_remaining_cents, r.currency) : "Soldé", bold);
  pair(`Solde total (${r.currency})`, formatMoney(r.currency_remaining_cents, r.currency), bold);
  if (r.status === "cancelled") {
    rule();
    line("*** PAIEMENT ANNULÉ ***", base + 1, bold, "center");
    if (r.cancel_reason) line(`Motif : ${r.cancel_reason}`, base - 1);
  }
  rule();
  line(`Reçu par : ${r.agent_name}`, base - 0.5);
  if (r.comment) line(`Note : ${r.comment.slice(0, 120)}`, base - 1);
  items.push({ kind: "space", h: 4 });
  line(r.receipt_footer || "Merci pour votre paiement. Conservez ce reçu.", base - 1.5, font, "center");
  line("Scolar", base - 2, font, "center");

  const heightOf = (it: Item) =>
    it.kind === "rule" ? 8 : it.kind === "space" ? it.h : it.size * 1.35;
  const height = items.reduce((h, it) => h + heightOf(it), 0) + 2 * margin;
  const page = pdf.addPage([width, height]);
  let y = height - margin;
  for (const it of items) {
    const h = heightOf(it);
    if (it.kind === "rule") {
      page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: width - margin, y: y - 4 }, thickness: 0.6, color: black, dashArray: [2, 2] });
    } else if (it.kind === "text") {
      const w = it.f.widthOfTextAtSize(it.s, it.size);
      const x = it.align === "center" ? (width - w) / 2 : it.align === "right" ? width - margin - w : margin;
      page.drawText(it.s, { x, y: y - it.size, size: it.size, font: it.f, color: black });
    } else if (it.kind === "pair") {
      const v = clean(it.value);
      page.drawText(clean(it.label), { x: margin, y: y - it.size, size: it.size, font, color: black });
      page.drawText(v, { x: width - margin - it.f.widthOfTextAtSize(v, it.size), y: y - it.size, size: it.size, font: it.f, color: black });
    }
    y -= h;
  }
  return pdf.save();
}
