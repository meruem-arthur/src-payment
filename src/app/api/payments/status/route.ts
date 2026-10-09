import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/payments/status?ref=<payment reference> - what the payment-status page polls.
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref) return NextResponse.json({ error: "Missing ref" }, { status: 400 });
  const payment = await prisma.payment.findUnique({ where: { internalReference: ref }, include: { receipt: true } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  return NextResponse.json({ status: payment.status, receiptNumber: payment.receipt?.receiptNumber ?? null }, { headers: { "Cache-Control": "no-store" } });
}
