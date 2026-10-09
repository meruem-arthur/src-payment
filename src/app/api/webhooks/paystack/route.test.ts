import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({ prisma: {
  payment: { findUnique: vi.fn(), updateMany: vi.fn() },
  paymentProviderConfiguration: { findUnique: vi.fn() },
  webhookEvent: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
} }));
vi.mock("@/lib/payments/provider-factory", () => ({ getPaymentProvider: vi.fn() }));
vi.mock("@/lib/payments/confirm-payment", () => ({ confirmSuccessfulPayment: vi.fn() }));

import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments/provider-factory";
import { confirmSuccessfulPayment } from "@/lib/payments/confirm-payment";
import { POST } from "./route";

const db = vi.mocked(prisma, true) as any;
const provider = { verifyWebhookSignature: vi.fn(), parseWebhookPayload: vi.fn(), verifyTransaction: vi.fn() };
const hook = (event = "charge.success") => POST(new NextRequest("http://localhost/api/webhooks/paystack", { method: "POST", headers: { "x-paystack-signature": "sig" }, body: JSON.stringify({ event, data: { reference: "PAY-1", id: 55 } }) }));
const dupe = () => Object.assign(new Error("unique"), { code: "P2002" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPaymentProvider).mockReturnValue(provider as any);
  db.payment.findUnique.mockResolvedValue({ id: "p1", internalReference: "PAY-1", amount: 60, currency: "GHS" });
  db.paymentProviderConfiguration.findUnique.mockResolvedValue({ secretKey: "sk", publicKey: "pk", webhookSecret: "wh", environment: "TEST" });
  provider.verifyWebhookSignature.mockReturnValue(true);
  provider.parseWebhookPayload.mockReturnValue({ success: true, providerEventId: "charge.success:55", providerTxId: "55", internalReference: "PAY-1" });
  provider.verifyTransaction.mockResolvedValue({ success: true, internalReference: "PAY-1", amount: 60, currency: "GHS", providerTxId: "55", paidAt: null });
  db.webhookEvent.create.mockResolvedValue({});
  db.webhookEvent.updateMany.mockResolvedValue({});
  db.payment.updateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/webhooks/paystack", () => {
  it("confirms a verified successful payment", async () => {
    expect((await hook()).status).toBe(200);
    expect(confirmSuccessfulPayment).toHaveBeenCalledWith("p1", { providerTxId: "55", paidAt: null });
    expect(db.webhookEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { processed: true } }));
  });
  it("treats an already-finished event as a duplicate and does nothing", async () => {
    db.webhookEvent.create.mockRejectedValue(dupe());
    db.webhookEvent.findUnique.mockResolvedValue({ processed: true });
    const res = await hook();
    expect((await res.json()).duplicate).toBe(true);
    expect(confirmSuccessfulPayment).not.toHaveBeenCalled();
  });
  it("finishes the job when Paystack retries an event whose first attempt never completed", async () => {
    db.webhookEvent.create.mockRejectedValue(dupe());
    db.webhookEvent.findUnique.mockResolvedValue({ processed: false });
    expect((await hook()).status).toBe(200);
    expect(confirmSuccessfulPayment).toHaveBeenCalledTimes(1);
  });
  it("never downgrades an already-successful payment to FAILED", async () => {
    provider.parseWebhookPayload.mockReturnValue({ success: false, providerEventId: "charge.failed:55" });
    await hook("charge.failed");
    expect(db.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", status: { not: "SUCCESS" } } }));
  });
  it("rejects a bad signature", async () => {
    provider.verifyWebhookSignature.mockReturnValue(false);
    expect((await hook()).status).toBe(401);
    expect(confirmSuccessfulPayment).not.toHaveBeenCalled();
  });
});
