import { prisma } from "@/lib/db";
import { PRODUCTS } from "@/lib/catalog";
import { decryptSmsApiKey } from "@/lib/crypto/field-encryption";
import { generateReceiptPdf } from "@/lib/receipts-pdf";
import { getSmsProvider, type SmsProviderName } from "@/lib/sms/provider-factory";
import { renderSmsTemplate } from "@/lib/sms/template";
import { captureError } from "@/lib/monitoring/capture-error";

type LineItem = { id?: string; label: string; amount: number };

function lineItems(items: unknown): LineItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter((i): i is LineItem => !!i && typeof i.label === "string" && typeof i.amount === "number");
}

/** REC-<year>-<6 digit sequence>. `offset` lets a retry step past a number another request just took. */
export async function generateReceiptNumber(offset = 0): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.receipt.count({ where: { receiptNumber: { startsWith: `REC-${year}-` } } });
  return `REC-${year}-${(count + 1 + offset).toString().padStart(6, "0")}`;
}

/**
 * Creates the receipt for a SUCCESS payment. Safe to call repeatedly or
 * concurrently: exactly one caller gets `created: true`; everyone else gets
 * the existing receipt. Only the creator should send the SMS, which is what
 * stops a retried webhook from texting a student twice.
 */
export async function issueReceipt(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status !== "SUCCESS") throw new Error("Cannot issue a receipt for a payment that is not SUCCESS");
  const existing = await prisma.receipt.findUnique({ where: { paymentId } });
  if (existing) return { receipt: existing, created: false };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const receipt = await prisma.receipt.create({ data: { receiptNumber: await generateReceiptNumber(attempt), paymentId, studentId: payment.studentId } });
      return { receipt, created: true };
    } catch (err: any) {
      if (err?.code !== "P2002") throw err;
      const winner = await prisma.receipt.findUnique({ where: { paymentId } });
      if (winner) return { receipt: winner, created: false };
    }
  }
  throw new Error("Could not allocate a unique receipt number after several attempts");
}

/** Builds the PDF for a confirmed payment, looked up by its public payment reference. Null if there is no receipt yet. */
export async function buildReceiptPdf(internalReference: string) {
  const payment = await prisma.payment.findUnique({ where: { internalReference }, include: { student: true, receipt: true } });
  if (!payment || payment.status !== "SUCCESS" || !payment.receipt) return null;
  const items = lineItems(payment.items);
  const rs = await prisma.receiptSettings.findUnique({ where: { id: "singleton" } }).catch(() => null);
  const pdfBytes = await generateReceiptPdf({
    receiptNumber: payment.receipt.receiptNumber,
    issuedAt: payment.receipt.issuedAt,
    student: { fullName: payment.student.fullName, referenceNumber: payment.student.referenceNumber },
    payment: { internalReference: payment.internalReference, currency: payment.currency, amount: Number(payment.amount), provider: payment.provider, paidAt: payment.paidAt, items },
    signatories: rs ? { president: { name: rs.presidentName, signatureUrl: rs.presidentSignature }, treasurer: { name: rs.treasurerName, signatureUrl: rs.treasurerSignature } } : undefined,
  });
  return { pdfBytes, receiptNumber: payment.receipt.receiptNumber };
}

/**
 * Texts the student their confirmation using the settings saved in Admin >
 * SMS settings. Never throws for delivery problems and can never change
 * payment or receipt state - a failed SMS is only recorded in NotificationLog.
 */
export async function sendReceiptSms(paymentId: string): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { student: true, receipt: true } });
  if (payment.status !== "SUCCESS" || !payment.receipt) throw new Error("Cannot send a receipt for a payment that hasn't succeeded yet");

  const config = await prisma.smsConfiguration.findUnique({ where: { id: "singleton" } });
  if (!config || !config.enabled) return "SKIPPED";

  const items = lineItems(payment.items);
  const itemNames = items.map((i) => (i.id && i.id in PRODUCTS ? PRODUCTS[i.id as keyof typeof PRODUCTS].short : i.label)).join(", ");
  const amount = Number(payment.amount);
  const message = renderSmsTemplate(config.messageTemplate, {
    name: payment.student.fullName,
    reference: payment.student.referenceNumber,
    items: itemNames || "Payment",
    amount: Number.isInteger(amount) ? amount.toString() : amount.toFixed(2),
    receipt: payment.receipt.receiptNumber,
  });

  const creds = decryptSmsApiKey(config);
  const result = await getSmsProvider(config.provider as SmsProviderName).send(
    { to: payment.student.phone, message, senderId: config.senderId },
    { apiKey: creds.apiKey, username: creds.username },
  );
  await prisma.notificationLog.create({ data: { channel: "SMS", recipient: payment.student.phone, status: result.success ? "SENT" : "FAILED", errorMessage: result.error, relatedPaymentId: payment.id } })
    .catch((e: unknown) => captureError(e, { context: "sms-notification-log", paymentId }));
  return result.success ? "SENT" : "FAILED";
}
