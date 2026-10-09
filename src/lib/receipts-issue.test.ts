import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = { $executeRawUnsafe: vi.fn(), receipt: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() } };
vi.mock("@/lib/db", () => ({ prisma: { payment: { findUniqueOrThrow: vi.fn() }, receipt: { findUnique: vi.fn() }, $transaction: vi.fn() } }));

import { prisma } from "@/lib/db";
import { issueReceipt } from "./receipts";

const db = vi.mocked(prisma, true) as any;
const year = new Date().getFullYear();

beforeEach(() => {
  vi.clearAllMocks();
  db.payment.findUniqueOrThrow.mockResolvedValue({ id: "p1", status: "SUCCESS", studentId: "s1" });
  db.receipt.findUnique.mockResolvedValue(null);
  db.$transaction.mockImplementation((fn: any) => fn(tx));
  tx.receipt.findUnique.mockResolvedValue(null);
  tx.receipt.findMany.mockResolvedValue([]);
  tx.receipt.create.mockImplementation(async ({ data }: any) => ({ id: "r1", ...data }));
});

describe("issueReceipt", () => {
  it("takes the numbering lock before reading the last number and creating the receipt", async () => {
    const out = await issueReceipt("p1");
    expect(out.created).toBe(true);
    expect(out.receipt.receiptNumber).toBe(`REC-${year}-000001`);
    const lock = tx.$executeRawUnsafe.mock.invocationCallOrder[0];
    expect(lock).toBeLessThan(tx.receipt.findMany.mock.invocationCallOrder[0]);
    expect(lock).toBeLessThan(tx.receipt.create.mock.invocationCallOrder[0]);
    expect(tx.$executeRawUnsafe.mock.calls[0][0]).toContain("pg_advisory_xact_lock");
  });
  it("numbers from the highest existing receipt", async () => {
    tx.receipt.findMany.mockResolvedValue([{ receiptNumber: `REC-${year}-000007` }, { receiptNumber: `REC-${year}-PAY-OLD` }]);
    expect((await issueReceipt("p1")).receipt.receiptNumber).toBe(`REC-${year}-000008`);
  });
  it("returns the existing receipt without opening a transaction", async () => {
    db.receipt.findUnique.mockResolvedValue({ id: "r0", receiptNumber: "REC-X" });
    expect(await issueReceipt("p1")).toEqual({ receipt: { id: "r0", receiptNumber: "REC-X" }, created: false });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("doesn't create a second receipt if another request issued one while we waited for the lock", async () => {
    tx.receipt.findUnique.mockResolvedValue({ id: "r9", receiptNumber: `REC-${year}-000002` });
    const out = await issueReceipt("p1");
    expect(out.created).toBe(false);
    expect(tx.receipt.create).not.toHaveBeenCalled();
  });
  it("refuses a payment that hasn't succeeded", async () => {
    db.payment.findUniqueOrThrow.mockResolvedValue({ id: "p1", status: "PENDING" });
    await expect(issueReceipt("p1")).rejects.toThrow();
  });
});
