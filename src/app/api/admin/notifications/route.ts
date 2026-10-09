import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authorization";
import { captureError } from "@/lib/monitoring/capture-error";

// Any signed-in admin can see failed SMS / email sends, so a revoked key, an
// unverified sender or a bad address shows up here instead of being found
// when a student says they never got their receipt.
export async function GET() {
  try {
    await requireAuth();
    const failures = await prisma.notificationLog.findMany({
      where: { status: "FAILED", resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const paymentIds = failures.map((f: { relatedPaymentId: string | null }) => f.relatedPaymentId).filter((id: string | null): id is string => Boolean(id));
    const payments = paymentIds.length
      ? await prisma.payment.findMany({ where: { id: { in: paymentIds } }, select: { id: true, student: { select: { fullName: true, referenceNumber: true } } } })
      : [];
    const byId = new Map(payments.map((p: { id: string; student: { fullName: string; referenceNumber: string } }) => [p.id, p.student]));
    return NextResponse.json({
      failures: failures.map((f: any) => ({
        id: f.id, channel: f.channel, recipient: f.recipient, errorMessage: f.errorMessage, createdAt: f.createdAt,
        student: f.relatedPaymentId ? byId.get(f.relatedPaymentId) ?? null : null,
      })),
    });
  } catch (e: any) {
    if (!e?.status) captureError(e);
    return NextResponse.json({ error: e?.status === 401 ? "Sign in required" : "Unable to load delivery failures" }, { status: e?.status || 500 });
  }
}
