import fs from "fs/promises";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { BRANDING } from "@/lib/branding";

export type ReceiptPdfData = {
  receiptNumber: string;
  issuedAt: Date;
  student: { fullName: string; referenceNumber: string };
  payment: {
    internalReference: string;
    currency: string;
    amount: number;
    provider: string; // "PAYSTACK"
    paidAt: Date | null;
    items: { label: string; amount: number }[];
  };
  // Set by the Super Admin (Admin > Receipts & QR). Shown only if configured.
  signatories?: {
    president?: { name?: string | null; signatureUrl?: string | null } | null;
    treasurer?: { name?: string | null; signatureUrl?: string | null } | null;
  };
};

const PAGE_WIDTH = 419.53; // A5 portrait width, points
const MIN_HEIGHT = 595.28;
const MARGIN = 36;
const GREEN = rgb(0.106, 0.369, 0.173);
const RED = rgb(0.78, 0.16, 0.18);
const GOLD = rgb(0.96, 0.69, 0.1);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.4, 0.4);
const RULE = rgb(0.82, 0.82, 0.82);

async function loadLogo(pdfDoc: PDFDocument, file: string) {
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", file));
    return await pdfDoc.embedPng(bytes);
  } catch {
    return null; // a missing logo must never stop a receipt being issued
  }
}

/** Signatures are stored as PNG/JPEG data URLs. Null on anything missing or corrupt - never blocks a receipt. */
async function embedDataUrlImage(pdfDoc: PDFDocument, dataUrl: string | null | undefined) {
  if (!dataUrl) return null;
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    const bytes = Buffer.from(m[2], "base64");
    return m[1].toLowerCase() === "png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
  } catch { return null; }
}

/** Standard PDF fonts only cover WinAnsi - swap anything else for the nearest safe character. */
function safe(font: PDFFont, text: string) {
  const set = new Set(font.getCharacterSet());
  return Array.from(text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')).map((ch) => {
    const cp = ch.codePointAt(0)!;
    if (set.has(cp)) return ch;
    const base = ch.normalize("NFD")[0];
    return set.has(base.codePointAt(0)!) ? base : "?";
  }).join("");
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = safe(font, text).split(/\s+/).filter(Boolean);
  const lines: string[] = []; let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

const money = (n: number) => (Number.isInteger(n) ? n.toFixed(2) : n.toFixed(2));
const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Accra" });

function centered(page: PDFPage, text: string, y: number, size: number, font: PDFFont, color = INK) {
  const t = safe(font, text);
  page.drawText(t, { x: (PAGE_WIDTH - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
}

function row(page: PDFPage, y: number, label: string, value: string, font: PDFFont, bold: PDFFont) {
  page.drawText(label, { x: MARGIN, y, size: 10, font: bold, color: MUTED });
  page.drawText(safe(font, value), { x: MARGIN + 105, y, size: 10, font, color: INK });
}

/**
 * Official SRC payment receipt (A5 portrait): letterhead with both logos,
 * receipt/payer details, an itemised table (S/N, item, unit price) with the
 * total, and the enquiry line. Page height grows with the number of items.
 */
export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const [crest, srcLogo] = await Promise.all([loadLogo(pdfDoc, "school-crest.png"), loadLogo(pdfDoc, "src-logo.png")]);

  // Lay the item rows out first so the page can be sized to fit them.
  const colSn = MARGIN + 8, colItem = MARGIN + 38, colPrice = PAGE_WIDTH - MARGIN - 8;
  const itemWidth = colPrice - colItem - 70;
  const items = data.payment.items.length ? data.payment.items : [{ label: "Payment", amount: data.payment.amount }];
  const laid = items.map((it) => ({ ...it, lines: wrap(font, it.label, 9.5, itemWidth) }));
  const rowsHeight = laid.reduce((h, r) => h + r.lines.length * 12 + 10, 0);
  const sig = data.signatories;
  const signers = [
    { role: "President", name: sig?.president?.name?.trim() || "", image: await embedDataUrlImage(pdfDoc, sig?.president?.signatureUrl) },
    { role: "Treasurer", name: sig?.treasurer?.name?.trim() || "", image: await embedDataUrlImage(pdfDoc, sig?.treasurer?.signatureUrl) },
  ];
  const showSignatories = signers.some((s) => s.name || s.image);
  const pageHeight = Math.max(MIN_HEIGHT, 440 + rowsHeight + (showSignatories ? 135 : 0));
  const page = pdfDoc.addPage([PAGE_WIDTH, pageHeight]);

  // Flag-coloured band across the top (green / gold / red, like the SRC letterhead).
  const third = PAGE_WIDTH / 3;
  page.drawRectangle({ x: 0, y: pageHeight - 8, width: third, height: 8, color: RED });
  page.drawRectangle({ x: third, y: pageHeight - 8, width: third, height: 8, color: GOLD });
  page.drawRectangle({ x: third * 2, y: pageHeight - 8, width: third, height: 8, color: GREEN });

  let y = pageHeight - 30;
  const logoBox = 44;
  for (const [img, x] of [[crest, MARGIN], [srcLogo, PAGE_WIDTH - MARGIN - logoBox]] as const) {
    if (!img) continue;
    const s = Math.min(logoBox / img.width, logoBox / img.height);
    page.drawImage(img, { x: x + (logoBox - img.width * s) / 2, y: y - logoBox + 4, width: img.width * s, height: img.height * s });
  }
  centered(page, BRANDING.council, y - 10, 12.5, bold, GREEN);
  centered(page, BRANDING.university, y - 24, 8.5, bold, GREEN);
  centered(page, BRANDING.campus, y - 36, 8.5, bold, GREEN);

  y -= 62;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1.5, color: GREEN });
  y -= 24;
  centered(page, "OFFICIAL PAYMENT RECEIPT", y, 13, bold, INK);
  y -= 13;
  centered(page, BRANDING.receiptSubtitle, y, 7, font, MUTED);

  // Receipt + payer details
  y -= 28;
  row(page, y, "Receipt No.", data.receiptNumber, bold, bold); y -= 17;
  row(page, y, "Date Issued", fmtDate(data.issuedAt), font, bold); y -= 17;
  if (data.payment.paidAt) { row(page, y, "Date Paid", fmtDate(data.payment.paidAt), font, bold); y -= 17; }
  row(page, y, "Student Name", data.student.fullName, font, bold); y -= 17;
  row(page, y, "Reference No.", data.student.referenceNumber, font, bold); y -= 17;
  row(page, y, "Payment Method", data.payment.provider === "PAYSTACK" ? "Paystack (online)" : data.payment.provider, font, bold); y -= 17;
  row(page, y, "Payment Ref.", data.payment.internalReference, font, bold);

  // Items table
  y -= 24;
  const tableLeft = MARGIN, tableRight = PAGE_WIDTH - MARGIN;
  page.drawRectangle({ x: tableLeft, y: y - 18, width: tableRight - tableLeft, height: 22, color: GREEN });
  page.drawText("S/N", { x: colSn, y: y - 11, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ITEM DESCRIPTION", { x: colItem, y: y - 11, size: 9, font: bold, color: rgb(1, 1, 1) });
  const hdr = `UNIT PRICE (${data.payment.currency})`;
  page.drawText(hdr, { x: colPrice - bold.widthOfTextAtSize(hdr, 9), y: y - 11, size: 9, font: bold, color: rgb(1, 1, 1) });
  y -= 18;

  laid.forEach((r, i) => {
    const h = r.lines.length * 12 + 10;
    page.drawLine({ start: { x: tableLeft, y: y - h }, end: { x: tableRight, y: y - h }, thickness: 0.5, color: RULE });
    page.drawText(String(i + 1), { x: colSn, y: y - 14, size: 9.5, font, color: INK });
    r.lines.forEach((ln, li) => page.drawText(ln, { x: colItem, y: y - 14 - li * 12, size: 9.5, font, color: INK }));
    const amt = money(r.amount);
    page.drawText(amt, { x: colPrice - font.widthOfTextAtSize(amt, 9.5), y: y - 14, size: 9.5, font, color: INK });
    y -= h;
  });

  page.drawRectangle({ x: tableLeft, y: y - 24, width: tableRight - tableLeft, height: 24, color: rgb(0.94, 0.97, 0.94) });
  page.drawText("TOTAL PAID", { x: colItem, y: y - 16, size: 10.5, font: bold, color: GREEN });
  const total = `${data.payment.currency} ${money(data.payment.amount)}`;
  page.drawText(total, { x: colPrice - bold.widthOfTextAtSize(total, 10.5), y: y - 16, size: 10.5, font: bold, color: GREEN });
  y -= 24;
  page.drawLine({ start: { x: tableLeft, y }, end: { x: tableRight, y }, thickness: 1, color: GREEN });

  // PAID stamp
  y -= 38;
  const stampW = 70, stampH = 26;
  page.drawRectangle({ x: (PAGE_WIDTH - stampW) / 2, y: y - 6, width: stampW, height: stampH, borderColor: GREEN, borderWidth: 1.5, color: rgb(1, 1, 1) });
  centered(page, "PAID", y + 3, 15, bold, GREEN);

  // Signatories (President left, Treasurer right)
  if (showSignatories) {
    y -= 40;
    const colW = (PAGE_WIDTH - 2 * MARGIN) / 2, imgMaxH = 38, imgMaxW = colW - 30, lineY = y - imgMaxH;
    signers.forEach((sg, i) => {
      if (!sg.name && !sg.image) return;
      const colX = MARGIN + i * colW, cx = colX + colW / 2;
      if (sg.image) {
        const sc = Math.min(imgMaxW / sg.image.width, imgMaxH / sg.image.height, 1);
        page.drawImage(sg.image, { x: cx - (sg.image.width * sc) / 2, y: lineY + 2, width: sg.image.width * sc, height: sg.image.height * sc });
      }
      page.drawLine({ start: { x: colX + 14, y: lineY }, end: { x: colX + colW - 14, y: lineY }, thickness: 0.75, color: rgb(0.6, 0.6, 0.6) });
      let ty = lineY - 12;
      if (sg.name) { const t = safe(bold, sg.name); page.drawText(t, { x: cx - bold.widthOfTextAtSize(t, 9.5) / 2, y: ty, size: 9.5, font: bold, color: INK }); ty -= 12; }
      page.drawText(sg.role, { x: cx - font.widthOfTextAtSize(sg.role, 8.5) / 2, y: ty, size: 8.5, font, color: MUTED });
    });
    y = lineY - 28;
  }

  // Footer
  y -= 44;
  centered(page, BRANDING.enquiry, y, 8, font, INK);
  centered(page, `Follow us @umat_srid_src   |   ${BRANDING.website}`, y - 12, 8, font, MUTED);
  centered(page, "This is a computer-generated receipt and does not require a physical signature.", 22, 7.5, font, MUTED);

  return pdfDoc.save();
}
