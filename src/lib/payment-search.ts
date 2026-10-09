import type { Prisma } from "@prisma/client";

const MAX_QUERY_LENGTH = 100;
const MAX_WORDS = 8;

/**
 * Turns what an admin typed in the search box into a database filter.
 * Every word must match the student's name, student reference number or the
 * receipt number (case-insensitive, partial matches allowed), so "kwame
 * mensah", "mensah kwa" and "20/1234" all find what you would expect.
 * Returns undefined for an empty search, which means "no filter".
 */
export function paymentSearchWhere(raw: string | null | undefined): Prisma.PaymentWhereInput | undefined {
  const words = (raw ?? "").trim().slice(0, MAX_QUERY_LENGTH).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  if (words.length === 0) return undefined;
  return {
    AND: words.map((word) => ({
      OR: [
        { student: { fullName: { contains: word, mode: "insensitive" as const } } },
        { student: { referenceNumber: { contains: word, mode: "insensitive" as const } } },
        { receipt: { receiptNumber: { contains: word, mode: "insensitive" as const } } },
      ],
    })),
  };
}

export type Delivery = { status: "PENDING" | "SENT" | "FAILED"; createdAt: Date; errorMessage: string | null };
export type DeliveryByPayment = Map<string, { sms?: Delivery; email?: Delivery }>;

/** Newest SMS and newest email attempt for each payment, from the notification log (newest rows first). */
export function latestDeliveries(
  logs: { relatedPaymentId: string | null; channel: "SMS" | "EMAIL"; status: Delivery["status"]; createdAt: Date; errorMessage: string | null }[],
): DeliveryByPayment {
  const out: DeliveryByPayment = new Map();
  for (const log of logs) {
    if (!log.relatedPaymentId) continue;
    const entry = out.get(log.relatedPaymentId) ?? {};
    const key = log.channel === "SMS" ? "sms" : "email";
    if (!entry[key]) entry[key] = { status: log.status, createdAt: log.createdAt, errorMessage: log.errorMessage };
    out.set(log.relatedPaymentId, entry);
  }
  return out;
}
