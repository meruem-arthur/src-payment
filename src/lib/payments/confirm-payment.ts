import { prisma } from "@/lib/db";
import { runInBackground } from "@/lib/background";
import { issueReceipt, sendReceiptSms } from "@/lib/receipts";

/**
 * The single place a verified payment becomes SUCCESS. The caller must have
 * verified the payment with Paystack first. Idempotent: the status flip is
 * conditional, one caller creates the receipt, and only that caller queues
 * the SMS - so a retried webhook never texts the student twice. The SMS runs
 * after the response (see runInBackground) and can never affect the payment.
 */
export async function confirmSuccessfulPayment(paymentId: string, verified: { providerTxId: string; paidAt: Date | null }) {
  const claim = await prisma.payment.updateMany({
    where: { id: paymentId, status: { not: "SUCCESS" } },
    data: { status: "SUCCESS", providerTxId: verified.providerTxId, paidAt: verified.paidAt ?? new Date(), failureReason: null },
  });
  const { receipt, created } = await issueReceipt(paymentId);
  if (created) runInBackground("receipt-sms", () => sendReceiptSms(paymentId));
  return { newlyConfirmed: claim.count > 0, receiptNumber: receipt.receiptNumber, receiptCreated: created };
}
