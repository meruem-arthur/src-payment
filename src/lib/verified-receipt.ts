import { prisma } from "@/lib/db";
import { isValidVerifyToken } from "@/lib/receipt-verify";

/**
 * What the /verify page shows. Returns the receipt only when the link's
 * signature is genuine AND the payment behind it is still successful.
 * A bad signature never reaches the database, and "bad signature", "unknown
 * receipt" and "payment no longer valid" all look the same to the caller, so
 * nothing about other receipts can be probed.
 */
export async function getVerifiedReceipt(receiptNumber: string, token: string | null | undefined) {
  if (!isValidVerifyToken(receiptNumber, token)) return null;
  const receipt = await prisma.receipt.findUnique({ where: { receiptNumber }, include: { payment: true, student: true } });
  return receipt && receipt.payment.status === "SUCCESS" ? receipt : null;
}
