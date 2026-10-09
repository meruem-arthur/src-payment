import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({ prisma: { payment: { findUnique: vi.fn(), updateMany: vi.fn() }, paymentProviderConfiguration: { findUnique: vi.fn() }, auditLog: { create: vi.fn() } } }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/payments/provider-factory", () => ({ getPaymentProvider: vi.fn() }));
vi.mock("@/lib/payments/confirm-payment", () => ({ confirmSuccessfulPayment: vi.fn() }));

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { getPaymentProvider } from "@/lib/payments/provider-factory";
import { confirmSuccessfulPayment } from "@/lib/payments/confirm-payment";
import { POST } from "./route";

const db = vi.mocked(prisma, true);
const session = vi.mocked(getServerSession);
const verify = vi.fn();
const call = () => POST(new NextRequest("http://localhost/api/admin/payments/p1/cancel", { method: "POST" }), { params: { id: "p1" } });
const pay = (o: object) => ({ id: "p1", status: "FAILED", internalReference: "PAY-1", amount: 60, currency: "GHS", providerTxId: null, failureReason: "Invalid key", ...o } as any);

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ user: { id: "u1", name: "Ama", email: "a@x.com", role: "ADMIN" } } as any);
  db.paymentProviderConfiguration.findUnique.mockResolvedValue({ secretKey: "sk", publicKey: "pk", webhookSecret: "wh", environment: "TEST" } as any);
  db.payment.updateMany.mockResolvedValue({ count: 1 } as any);
  db.auditLog.create.mockResolvedValue({} as any);
  vi.mocked(getPaymentProvider).mockReturnValue({ verifyTransaction: verify } as any);
});

describe("POST /api/admin/payments/[id]/cancel", () => {
  it("requires sign-in", async () => {
    session.mockResolvedValue(null as any);
    expect((await call()).status).toBe(401);
  });
  it("lets a plain Admin cancel a failed payment and keeps the original reason", async () => {
    db.payment.findUnique.mockResolvedValue(pay({}));
    const res = await call();
    expect(res.status).toBe(200);
    expect(db.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CANCELLED", failureReason: "Cancelled by Ama (was: Invalid key)" } }));
    expect(db.auditLog.create).toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });
  it("never cancels a successful payment", async () => {
    db.payment.findUnique.mockResolvedValue(pay({ status: "SUCCESS" }));
    expect((await call()).status).toBe(409);
    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });
  it("confirms instead of cancelling a pending payment Paystack says was paid", async () => {
    db.payment.findUnique.mockResolvedValue(pay({ status: "PENDING" }));
    verify.mockResolvedValue({ success: true, internalReference: "PAY-1", amount: 60, currency: "GHS", providerTxId: "9", paidAt: null });
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).confirmed).toBe(true);
    expect(confirmSuccessfulPayment).toHaveBeenCalledWith("p1", { providerTxId: "9", paidAt: null });
    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });
  it("cancels a pending payment Paystack has no record of", async () => {
    db.payment.findUnique.mockResolvedValue(pay({ status: "PENDING", failureReason: null }));
    verify.mockRejectedValue(Object.assign(new Error("nope"), { status: 404 }));
    expect((await call()).status).toBe(200);
    expect(db.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CANCELLED", failureReason: "Cancelled by Ama" } }));
  });
  it("refuses to cancel a pending payment when Paystack can't be reached", async () => {
    db.payment.findUnique.mockResolvedValue(pay({ status: "PENDING" }));
    verify.mockRejectedValue(new Error("network down"));
    expect((await call()).status).toBe(502);
    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });
});
