import crypto from "crypto";

/**
 * Receipt verification links (the QR code printed on every PDF receipt).
 *
 * Receipt numbers are sequential (REC-2026-000001, ...), so a bare
 * /verify/<receiptNumber> page would let anyone walk through every student's
 * receipt. The link therefore carries a signature only this server can make
 * (HMAC of the receipt number, keyed by AUTH_SECRET): a printed QR works, a
 * guessed number doesn't.
 */
function sign(receiptNumber: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(`receipt-verify:${receiptNumber}`).digest("hex").slice(0, 24);
}

export function isValidVerifyToken(receiptNumber: string, token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const expected = Buffer.from(sign(receiptNumber));
    const given = Buffer.from(token);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

/** The URL encoded in the receipt's QR code, or null when the app's public URL isn't configured. */
export function receiptVerifyUrl(receiptNumber: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/verify/${encodeURIComponent(receiptNumber)}?t=${sign(receiptNumber)}`;
}
