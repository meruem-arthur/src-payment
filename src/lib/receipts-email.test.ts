import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { payment: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn() }, emailConfiguration: { findUnique: vi.fn() }, receiptSettings: { findUnique: vi.fn() }, notificationLog: { create: vi.fn() } } }));
vi.mock("@/lib/email/provider-factory", () => ({ getEmailProvider: vi.fn(() => ({ send })) }));
vi.mock("@/lib/crypto/field-encryption", async (orig) => ({ ...(await orig<any>()), decryptSecret: vi.fn((v: string) => `plain:${v}`) }));
vi.mock("@/lib/monitoring/capture-error", () => ({ captureError: vi.fn() }));

import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto/field-encryption";
import { sendReceiptEmail } from "./receipts";

const db = vi.mocked(prisma, true) as any;
const payment = (over: any = {}) => ({
  id: "p1", status: "SUCCESS", internalReference: "PAY-1", amount: 60, currency: "GHS", provider: "PAYSTACK", paidAt: new Date(), items: [{ label: "Safety Helmet", amount: 60 }],
  student: { fullName: "Ama Boateng", referenceNumber: "UMaT/1", phone: "0244", email: "ama@example.com" },
  receipt: { receiptNumber: "REC-2026-000001", issuedAt: new Date() }, ...over,
});
const config = (over: any = {}) => ({ id: "singleton", provider: "BREVO", senderName: "UMaT SRC", senderEmail: "receipts@school.edu", subject: "Receipt {receipt} for {name}", messageTemplate: "Hi {name}, GHS {amount} ({items}) {receipt}", apiKey: "enc", enabled: true, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  db.payment.findUniqueOrThrow.mockResolvedValue(payment());
  db.payment.findUnique.mockResolvedValue(payment());
  db.emailConfiguration.findUnique.mockResolvedValue(config());
  db.receiptSettings.findUnique.mockResolvedValue(null);
  db.notificationLog.create.mockResolvedValue({});
  send.mockResolvedValue({ success: true });
});

describe("sendReceiptEmail", () => {
  it("sends the filled-in email with the PDF attached and logs SENT", async () => {
    expect(await sendReceiptEmail("p1")).toBe("SENT");
    const [msg, creds] = send.mock.calls[0];
    expect(msg.to).toBe("ama@example.com");
    expect(msg.subject).toBe("Receipt REC-2026-000001 for Ama Boateng");
    expect(msg.body).toBe("Hi Ama Boateng, GHS 60 (Safety Helmet) REC-2026-000001");
    expect(msg.from).toEqual({ email: "receipts@school.edu", name: "UMaT SRC" });
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0].filename).toBe("REC-2026-000001.pdf");
    expect(msg.attachments[0].content.subarray(0, 4).toString()).toBe("%PDF");
    expect(creds).toEqual({ apiKey: "plain:enc" });
    expect(db.notificationLog.create).toHaveBeenCalledWith({ data: { channel: "EMAIL", recipient: "ama@example.com", status: "SENT", errorMessage: undefined, relatedPaymentId: "p1" } });
  });
  it("skips (and sends nothing) when email is turned off", async () => {
    db.emailConfiguration.findUnique.mockResolvedValue(config({ enabled: false }));
    expect(await sendReceiptEmail("p1")).toBe("SKIPPED");
    expect(send).not.toHaveBeenCalled();
    expect(db.notificationLog.create).not.toHaveBeenCalled();
  });
  it("skips a student who has no email on file", async () => {
    db.payment.findUniqueOrThrow.mockResolvedValue(payment({ student: { ...payment().student, email: null } }));
    expect(await sendReceiptEmail("p1")).toBe("SKIPPED");
    expect(send).not.toHaveBeenCalled();
  });
  it("records a failed send with the provider's reason", async () => {
    send.mockResolvedValue({ success: false, error: "Brevo rejected the email - nope" });
    expect(await sendReceiptEmail("p1")).toBe("FAILED");
    expect(db.notificationLog.create.mock.calls[0][0].data).toMatchObject({ channel: "EMAIL", status: "FAILED", errorMessage: "Brevo rejected the email - nope" });
  });
  it("still sends, with a note and no attachment, when the PDF can't be built", async () => {
    db.payment.findUnique.mockResolvedValue(null);
    expect(await sendReceiptEmail("p1")).toBe("SENT");
    const [msg] = send.mock.calls[0];
    expect(msg.attachments).toEqual([]);
    expect(msg.body).toContain("could not attach your PDF receipt");
  });
  it("logs a failure instead of throwing when the saved API key can't be decrypted", async () => {
    vi.mocked(decryptSecret).mockImplementationOnce(() => { throw new Error("bad key"); });
    expect(await sendReceiptEmail("p1")).toBe("FAILED");
    expect(send).not.toHaveBeenCalled();
    expect(db.notificationLog.create.mock.calls[0][0].data.errorMessage).toMatch(/ENCRYPTION_KEY/);
  });
  it("strips line breaks out of the subject", async () => {
    db.emailConfiguration.findUnique.mockResolvedValue(config({ subject: "Line1\r\nLine2 {receipt}" }));
    await sendReceiptEmail("p1");
    expect(send.mock.calls[0][0].subject).toBe("Line1 Line2 REC-2026-000001");
  });
  it("refuses to run for a payment that hasn't succeeded", async () => {
    db.payment.findUniqueOrThrow.mockResolvedValue(payment({ status: "PENDING" }));
    await expect(sendReceiptEmail("p1")).rejects.toThrow(/hasn't succeeded/);
  });
});
