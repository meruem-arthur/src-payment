import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authorization";
export async function GET() {
  try { await requireAuth(); const [payments, count, successful, pending, failed, revenue] = await Promise.all([
    prisma.payment.findMany({ include: { student: true, receipt: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.payment.count(), prisma.payment.count({ where: { status: "SUCCESS" } }), prisma.payment.count({ where: { status: "PENDING" } }), prisma.payment.count({ where: { status: "FAILED" } }), prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
  ]); return NextResponse.json({ payments, stats: { count, successful, pending, failed, revenue: Number(revenue._sum.amount || 0) } }); }
  catch (e: any) { return NextResponse.json({ error: e?.status === 401 ? "Sign in required" : "Unable to load payment records" }, { status: e?.status || 500 }); }
}
