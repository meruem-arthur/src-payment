import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authorization";
import { sendReceiptEmail, sendReceiptSms } from "@/lib/receipts";
import { captureError } from "@/lib/monitoring/capture-error";

// POST /api/admin/payments/[id]/resend  { channel: "SMS" | "EMAIL" } - Admin or Super Admin.
// Sends the student their receipt SMS / email again, using the saved SMS and
// Email settings. Only for successful payments that already have a receipt.
// The attempt is recorded in the notification log like any other send, so a
// failure also shows up in the Delivery log.
const COOLDOWN_MS = 30_000;
const json = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const channel = body?.channel;
    if (channel !== "SMS" && channel !== "EMAIL") return json("Choose SMS or EMAIL.", 400);

    const payment = await prisma.payment.findUnique({ where: { id: params.id }, include: { receipt: true } });
    if (!payment) return json("Payment not found", 404);
    if (payment.status !== "SUCCESS" || !payment.receipt) return json("Only a successful payment with a receipt can be resent.", 409);

    // Stops a double click (or two admins at once) from texting a student twice.
    const recent = await prisma.notificationLog.findFirst({ where: { relatedPaymentId: payment.id, channel, createdAt: { gte: new Date(Date.now() - COOLDOWN_MS) } } });
    if (recent) return json("That was just sent. Wait a few seconds before sending it again.", 429);

    const result = channel === "SMS" ? await sendReceiptSms(payment.id) : await sendReceiptEmail(payment.id);
    await prisma.auditLog.create({ data: { userId: user.id, action: `RECEIPT_${channel}_RESENT`, entity: "Payment", entityId: payment.id, metadata: { result, receiptNumber: payment.receipt.receiptNumber } } }).catch(() => {});

    if (result === "SENT") return NextResponse.json({ sent: true, channel });
    if (result === "SKIPPED") {
      return json(channel === "SMS" ? "SMS sending is turned off in SMS settings, so nothing was sent." : "Nothing was sent: email is turned off in Email settings, or this student has no email address.", 409);
    }
    return json(`The ${channel === "SMS" ? "SMS" : "email"} could not be delivered. See the Delivery log for the reason.`, 502);
  } catch (e: any) {
    if (e?.status === 401) return json("Sign in required", 401);
    captureError(e, { context: "resend-receipt" });
    return json("Could not resend this receipt", 500);
  }
}
