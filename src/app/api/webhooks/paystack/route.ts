import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments/provider-factory";
import { decryptPaymentSecrets } from "@/lib/crypto/field-encryption";
import { confirmSuccessfulPayment } from "@/lib/payments/confirm-payment";
export async function POST(req: NextRequest) {
  const rawBody = await req.text(); let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const reference = payload?.data?.reference; if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  const payment = await prisma.payment.findUnique({ where: { internalReference: reference }, include: { student: true } });
  if (!payment) return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
  const rawConfig = await prisma.paymentProviderConfiguration.findUnique({ where: { id: "singleton" } });
  if (!rawConfig?.secretKey) return NextResponse.json({ error: "Payment provider is not configured" }, { status: 503 });
  const config = decryptPaymentSecrets(rawConfig); const provider = getPaymentProvider("PAYSTACK");
  if (!provider.verifyWebhookSignature(rawBody, req.headers.get("x-paystack-signature"), { publicKey: config.publicKey, secretKey: config.secretKey, webhookSecret: config.webhookSecret, environment: config.environment })) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const parsed = provider.parseWebhookPayload(rawBody);
  try { await prisma.webhookEvent.create({ data: { paymentId: payment.id, provider: "PAYSTACK", providerEventId: parsed.providerEventId, rawPayload: payload, processed: false } }); }
  catch (e: any) {
    if (e?.code !== "P2002") throw e;
    // Only a FINISHED event is a duplicate. If an earlier delivery crashed part-way (database blip, etc.)
    // its row is still unprocessed, so Paystack's retry must be allowed to complete the job.
    const seen = await prisma.webhookEvent.findUnique({ where: { provider_providerEventId: { provider: "PAYSTACK", providerEventId: parsed.providerEventId } } });
    if (seen?.processed) return NextResponse.json({ received: true, duplicate: true });
  }
  // A failure event must never downgrade a payment that already succeeded (events can arrive out of order).
  if (!parsed.success) { const why = String(payload?.data?.gateway_response || payload?.event || "").slice(0, 300); await prisma.payment.updateMany({ where: { id: payment.id, status: { not: "SUCCESS" } }, data: { status: "FAILED", failureReason: why ? `Paystack: ${why}` : "Payment failed at Paystack" } }); await prisma.webhookEvent.updateMany({ where: { provider: "PAYSTACK", providerEventId: parsed.providerEventId }, data: { processed: true } }); return NextResponse.json({ received: true }); }
  const verified = await provider.verifyTransaction({ providerTxId: parsed.providerTxId, internalReference: parsed.internalReference }, { publicKey: config.publicKey, secretKey: config.secretKey, webhookSecret: config.webhookSecret, environment: config.environment });
  if (!verified.success || verified.internalReference !== payment.internalReference || verified.amount !== Number(payment.amount) || verified.currency !== payment.currency) return NextResponse.json({ error: "Payment verification mismatch" }, { status: 400 });
  await confirmSuccessfulPayment(payment.id, { providerTxId: verified.providerTxId, paidAt: verified.paidAt });
  await prisma.webhookEvent.updateMany({ where: { provider: "PAYSTACK", providerEventId: parsed.providerEventId }, data: { processed: true } });
  return NextResponse.json({ received: true });
}
