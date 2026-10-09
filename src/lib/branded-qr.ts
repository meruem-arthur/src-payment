import QRCode from "qrcode";
import { QR_LOGO_DATA_URL } from "@/lib/qr-logo";

/**
 * Browser-only. Returns a PNG data URL of a QR code with the SRC crest in the
 * middle. Error correction level H lets the code survive ~30% damage while the
 * crest covers only ~5% of its area, so it still scans (checked by decoding it).
 */
export async function brandedQrDataUrl(text: string, size = 800): Promise<string> {
  const qrUrl = await QRCode.toDataURL(text, { errorCorrectionLevel: "H", margin: 2, width: size, color: { dark: "#111111", light: "#ffffff" } });
  const [qr, logo] = await Promise.all([loadImage(qrUrl), loadImage(QR_LOGO_DATA_URL).catch(() => null)]);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return qrUrl;
  ctx.drawImage(qr, 0, 0, size, size);
  if (logo) {
    const back = size * 0.25, mark = size * 0.21, c = size / 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(c - back / 2, c - back / 2, back, back);
    ctx.drawImage(logo, c - mark / 2, c - mark / 2, mark, mark);
  }
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}
