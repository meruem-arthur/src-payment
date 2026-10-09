import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authorization";
import { latestDeliveries, paymentSearchWhere } from "@/lib/payment-search";

// GET /api/admin/payments?q=<name, reference number or receipt number>
// Any signed-in admin. With no q it returns the 500 newest payments; with a q
// it searches every payment, so older students can be found too. The stats
// cards always describe all payments, not just the search results.
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const where = paymentSearchWhere(req.nextUrl.searchParams.get("q"));
    const [payments, count, successful, pending, failed, cancelled, revenue] = await Promise.all([
      prisma.payment.findMany({ where, include: { student: true, receipt: true }, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.payment.count(), prisma.payment.count({ where: { status: "SUCCESS" } }), prisma.payment.count({ where: { status: "PENDING" } }), prisma.payment.count({ where: { status: "FAILED" } }), prisma.payment.count({ where: { status: "CANCELLED" } }), prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    ]);
    const logs = payments.length
      ? await prisma.notificationLog.findMany({ where: { relatedPaymentId: { in: payments.map((p: { id: string }) => p.id) } }, orderBy: { createdAt: "desc" }, take: 5000 })
      : [];
    const deliveries = latestDeliveries(logs);
    return NextResponse.json({
      payments: payments.map((p: { id: string }) => ({ ...p, lastSms: deliveries.get(p.id)?.sms ?? null, lastEmail: deliveries.get(p.id)?.email ?? null })),
      stats: { count, successful, pending, failed, cancelled, revenue: Number(revenue._sum.amount || 0) },
    });
  } catch (e: any) { return NextResponse.json({ error: e?.status === 401 ? "Sign in required" : "Unable to load payment records" }, { status: e?.status || 500 }); }
}
