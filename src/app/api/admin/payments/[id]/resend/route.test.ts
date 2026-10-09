import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({ prisma: { payment: { findUnique: vi.fn() }, notificationLog: { findFirst: vi.fn() }, auditLog: { create: vi.fn() } } }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/receipts", () => ({ sendReceiptSms: vi.fn(), sendReceiptEmail: vi.fn() }));

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { sendReceiptEmail, sendReceiptSms } from "@/lib/receipts";
import { POST } from "./route";

const db = vi.mocked(prisma, true);
const session = vi.mocked(getServerSession);
const sms = vi.mocked(sendReceiptSms);
const email = vi.mocked(sendReceiptEmail);
const call = (body: unknown) => POST(new NextRequest("http://localhost/api/admin/payments/p1/resend", { method: "POST", body: JSON.stringify(body) }), { params: { id: "p1" } });
const paid = (o: object = {}) => ({ id: "p1", status: "SUCCESS", receipt: { receiptNumber: "REC-2026-0001" }, ...o } as any);

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ user: { id: "u1", name: "Ama", email: "a@x.com", role: "ADMIN" } } as any);
  db.payment.findUnique.mockResolvedValue(paid());
  db.notificationLog.findFirst.mockResolvedValue(null);
  db.auditLog.create.mockResolvedValue({} as any);
});

describe("POST /api/admin/payments/[id]/resend", () => {
  it("requires sign-in", async () => {
    session.mockResolvedValue(null as any);
    expect((await call({ channel: "SMS" })).status).toBe(401);
    expect(sms).not.toHaveBeenCalled();
  });
  it("rejects an unknown channel", async () => {
    expect((await call({ channel: "FAX" })).status).toBe(400);
  });
  it("lets a plain Admin resend the SMS and records it in the audit log", async () => {
    sms.mockResolvedValue("SENT");
    const res = await call({ channel: "SMS" });
    expect(res.status).toBe(200);
    expect(sms).toHaveBeenCalledWith("p1");
    expect(email).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "RECEIPT_SMS_RESENT", entityId: "p1" }) }));
  });
  it("resends the email", async () => {
    email.mockResolvedValue("SENT");
    expect((await call({ channel: "EMAIL" })).status).toBe(200);
    expect(email).toHaveBeenCalledWith("p1");
  });
  it("never resends for a payment that has not succeeded", async () => {
    db.payment.findUnique.mockResolvedValue(paid({ status: "PENDING", receipt: null }));
    expect((await call({ channel: "SMS" })).status).toBe(409);
    expect(sms).not.toHaveBeenCalled();
  });
  it("404s for an unknown payment", async () => {
    db.payment.findUnique.mockResolvedValue(null);
    expect((await call({ channel: "SMS" })).status).toBe(404);
  });
  it("blocks a repeat send within a few seconds", async () => {
    db.notificationLog.findFirst.mockResolvedValue({ id: "n1" } as any);
    expect((await call({ channel: "SMS" })).status).toBe(429);
    expect(sms).not.toHaveBeenCalled();
  });
  it("explains when sending is switched off or the student has no email", async () => {
    email.mockResolvedValue("SKIPPED");
    const res = await call({ channel: "EMAIL" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/turned off/);
  });
  it("reports a delivery failure", async () => {
    sms.mockResolvedValue("FAILED");
    expect((await call({ channel: "SMS" })).status).toBe(502);
  });
});
