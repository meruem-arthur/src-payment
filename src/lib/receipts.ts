import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PRODUCTS } from "@/lib/catalog";
import { decryptSecret, decryptSmsApiKey } from "@/lib/crypto/field-encryption";
import { generateReceiptPdf } from "@/lib/receipts-pdf";
import { getSmsProvider, type SmsProviderName } from "@/lib/sms/provider-factory";
import { renderSmsTemplate } from "@/lib/sms/template";
import { getEmailProvider, type EmailProviderName } from "@/lib/email/provider-factory";
import { renderEmailTemplate, singleLine } from "@/lib/email/template";
import { nextReceiptNumber } from "@/lib/receipt-number";
import { receiptVerifyUrl } from "@/lib/receipt-verify";
import { captureError } from "@/lib/monitoring/capture-error";

type LineItem = { id?: string; label: string; amount: number };

function lineItems(items: unknown): LineItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter((i): i is LineItem => !!i && typeof i.label === "string" && typeof i.amount === "number");
}

// Arbitrary constant. Whoever holds this database lock is the only request
// numbering a receipt, so receipt numbers come out one at a time with no gaps
// and no collisions, however many payments are confirmed in the same moment.
const RECEIPT_LOCK_KEY = 72707371;

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

  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Queue up here. The lock is released automatically when this transaction ends.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${RECEIPT_LOCK_KEY})`);
      // Someone else may have issued this payment's receipt while we waited.
      const already = await tx.receipt.findUnique({ where: { paymentId } });
      if (already) return { receipt: already, created: false };
      const year = new Date().getFullYear();
      const issued = await tx.receipt.findMany({ where: { receiptNumber: { startsWith: `REC-${year}-` } }, select: { receiptNumber: true } });
      const receipt = await tx.receipt.create({ data: { receiptNumber: nextReceiptNumber(issued.map((r: { receiptNumber: string }) => r.receiptNumber), year), paymentId, studentId: payment.studentId } });
      return { receipt, created: true };
    }, { maxWait: 10_000, timeout: 20_000 });
  } catch (err: any) {
    // Belt and braces: if a unique clash still happens, the payment's receipt exists - hand that back.
    if (err?.code === "P2002") {
      const winner = await prisma.receipt.findUnique({ where: { paymentId } });
      if (winner) return { receipt: winner, created: false };
    }
    throw err;
  }
}

/** Builds the PDF for a confirmed payment, looked up by its public payment reference. Null if there is no receipt yet. */
export async function buildReceiptPdf(internalReference: string) {
  const payment = await prisma.payment.findUnique({ where: { internalReference }, include: { student: true, receipt: true } });
  if (!payment || payment.status !== "SUCCESS" || !payment.receipt) return null;
  const items = lineItems(payment.items);
  const rs = await prisma.receiptSettings.findUnique({ where: { id: "singleton" } }).catch(() => null);
  // The QR on the PDF. If it can't be made (e.g. NEXT_PUBLIC_APP_URL unset) the receipt is still issued, just without it.
  let verifyUrl: string | null = null;
  try { verifyUrl = receiptVerifyUrl(payment.receipt.receiptNumber); } catch (e) { captureError(e, { context: "receipt-verify-url" }); }
  const pdfBytes = await generateReceiptPdf({
    verifyUrl,
    receiptNumber: payment.receipt.receiptNumber,
    issuedAt: payment.receipt.issuedAt,
    student: { fullName: payment.student.fullName, referenceNumber: payment.student.referenceNumber },
    payment: { internalReference: payment.internalReference, currency: payment.currency, amount: Number(payment.amount), provider: payment.provider, paidAt: payment.paidAt, items },
    signatories: rs ? { president: { name: rs.presidentName, signatureUrl: rs.presidentSignature }, treasurer: { name: rs.treasurerName, signatureUrl: rs.treasurerSignature } } : undefined,
  });
  return { pdfBytes, receiptNumber: payment.receipt.receiptNumber };
}

/** The values every SMS / email template can use: {name} {reference} {items} {amount} {receipt}. */
function templateValues(
  payment: { amount: unknown; items: unknown; student: { fullName: string; referenceNumber: string } },
  receiptNumber: string,
) {
  const itemNames = lineItems(payment.items).map((i) => (i.id && i.id in PRODUCTS ? PRODUCTS[i.id as keyof typeof PRODUCTS].short : i.label)).join(", ");
  const amount = Number(payment.amount);
  return {
    name: payment.student.fullName,
    reference: payment.student.referenceNumber,
    items: itemNames || "Payment",
    amount: Number.isInteger(amount) ? amount.toString() : amount.toFixed(2),
    receipt: receiptNumber,
  };
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

  const message = renderSmsTemplate(config.messageTemplate, templateValues(payment, payment.receipt.receiptNumber));

  const creds = decryptSmsApiKey(config);
  const result = await getSmsProvider(config.provider as SmsProviderName).send(
    { to: payment.student.phone, message, senderId: config.senderId },
    { apiKey: creds.apiKey, username: creds.username },
  );
  await prisma.notificationLog.create({ data: { channel: "SMS", recipient: payment.student.phone, status: result.success ? "SENT" : "FAILED", errorMessage: result.error, relatedPaymentId: payment.id } })
    .catch((e: unknown) => captureError(e, { context: "sms-notification-log", paymentId }));
  return result.success ? "SENT" : "FAILED";
}

const PDF_MISSING_NOTE = "\n\n(We could not attach your PDF receipt to this email. You can download it from the payment status page you were sent to after paying.)";

/**
 * Emails the student their receipt (PDF attached) using the settings saved in
 * Admin > Email settings. Same rules as the SMS: never throws for delivery
 * problems, can never change payment or receipt state, and a failure is only
 * recorded in NotificationLog. A PDF that can't be built never blocks the
 * email - the student still gets the text, with a note.
 */
export async function sendReceiptEmail(paymentId: string): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { student: true, receipt: true } });
  if (payment.status !== "SUCCESS" || !payment.receipt) throw new Error("Cannot send a receipt for a payment that hasn't succeeded yet");

  const config = await prisma.emailConfiguration.findUnique({ where: { id: "singleton" } });
  if (!config || !config.enabled) return "SKIPPED";
  const to = payment.student.email?.trim();
  if (!to) return "SKIPPED"; // students registered before email became required may have none

  const log = (status: "SENT" | "FAILED", errorMessage?: string) =>
    prisma.notificationLog.create({ data: { channel: "EMAIL", recipient: to, status, errorMessage, relatedPaymentId: payment.id } })
      .catch((e: unknown) => captureError(e, { context: "email-notification-log", paymentId }));

  let apiKey: string | null = null;
  try {
    apiKey = config.apiKey ? decryptSecret(config.apiKey) : null;
  } catch (e) {
    captureError(e, { context: "email-api-key-decrypt", paymentId });
    await log("FAILED", "Could not read the saved Brevo API key - check ENCRYPTION_KEY, or save the key again in Admin > Email settings");
    return "FAILED";
  }

  const values = templateValues(payment, payment.receipt.receiptNumber);
  let body = renderEmailTemplate(config.messageTemplate, values);
  const attachments: { filename: string; content: Buffer }[] = [];
  try {
    const built = await buildReceiptPdf(payment.internalReference);
    if (built) attachments.push({ filename: `${built.receiptNumber}.pdf`, content: Buffer.from(built.pdfBytes) });
    else body += PDF_MISSING_NOTE;
  } catch (e) {
    captureError(e, { context: "receipt-pdf-for-email", paymentId });
    body += PDF_MISSING_NOTE;
  }

  const result = await getEmailProvider(config.provider as EmailProviderName).send(
    { to, subject: singleLine(renderEmailTemplate(config.subject, values)), body, from: { email: config.senderEmail, name: config.senderName }, attachments },
    { apiKey },
  );
  await log(result.success ? "SENT" : "FAILED", result.error);
  return result.success ? "SENT" : "FAILED";
}
