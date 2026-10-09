import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authorization";
import { decryptPaymentSecrets } from "@/lib/crypto/field-encryption";
import { getPaymentProvider } from "@/lib/payments/provider-factory";
import { confirmSuccessfulPayment } from "@/lib/payments/confirm-payment";
import { captureError } from "@/lib/monitoring/capture-error";

// POST /api/admin/payments/[id]/cancel - Admin or Super Admin.
// Cancels a FAILED or stuck PENDING payment so the student can start again.
// A PENDING payment is first checked with Paystack: if the money actually
// arrived it is confirmed (receipt + SMS) instead of cancelled, so a student
// can never be charged twice because an admin cancelled a payment that went through.
const json = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const payment = await prisma.payment.findUnique({ where: { id: params.id } });
    if (!payment) return json("Payment not found", 404);
    if (payment.status === "SUCCESS") return json("This payment was successful, so it can't be cancelled.", 409);
    if (payment.status === "CANCELLED") return json("This payment is already cancelled.", 409);
    if (payment.status !== "FAILED" && payment.status !== "PENDING") return json(`A ${payment.status.toLowerCase()} payment can't be cancelled.`, 409);

    if (payment.status === "PENDING") {
      const raw = await prisma.paymentProviderConfiguration.findUnique({ where: { id: "singleton" } });
      if (!raw?.secretKey) return json("Can't check this payment with Paystack because the payment provider isn't configured.", 503);
      const cfg = decryptPaymentSecrets(raw);
      try {
        const v = await getPaymentProvider("PAYSTACK").verifyTransaction(
          { providerTxId: payment.providerTxId ?? "", internalReference: payment.internalReference },
          { publicKey: cfg.publicKey, secretKey: cfg.secretKey, webhookSecret: cfg.webhookSecret, environment: cfg.environment },
        );
        if (v.success) {
          if (v.internalReference !== payment.internalReference || v.amount !== Number(payment.amount) || v.currency !== payment.currency) {
            return json("Paystack reports a payment that doesn't match this record. Check it on the Paystack dashboard before cancelling.", 409);
          }
          await confirmSuccessfulPayment(payment.id, { providerTxId: v.providerTxId, paidAt: v.paidAt });
          return json("Paystack shows this payment actually went through, so it was confirmed and a receipt was issued instead of cancelling.", 409, { confirmed: true });
        }
      } catch (e: any) {
        // 404 = Paystack has no record (e.g. the checkout was never opened), so it is safe to cancel.
        if (e?.status !== 404) {
          captureError(e, { context: "cancel-payment-verify", paymentId: payment.id });
          return json("Couldn't reach Paystack to check this payment. Please try again in a moment.", 502);
        }
      }
    }

    const who = user.name || user.email;
    const reason = `Cancelled by ${who}${payment.failureReason ? ` (was: ${payment.failureReason})` : ""}`.slice(0, 500);
    const res = await prisma.payment.updateMany({ where: { id: payment.id, status: { in: ["FAILED", "PENDING"] } }, data: { status: "CANCELLED", failureReason: reason } });
    if (res.count === 0) return json("This payment changed while you were cancelling it. Refresh and check its status.", 409);

    await prisma.auditLog.create({ data: { userId: user.id, action: "PAYMENT_CANCELLED", entity: "Payment", entityId: payment.id, metadata: { previousStatus: payment.status, previousReason: payment.failureReason, reference: payment.internalReference } } }).catch(() => {});
    return NextResponse.json({ cancelled: true });
  } catch (e: any) {
    if (e?.status === 401) return json("Sign in required", 401);
    captureError(e, { context: "cancel-payment" });
    return json("Could not cancel this payment", 500);
  }
}
