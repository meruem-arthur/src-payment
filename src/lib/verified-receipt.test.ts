import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { receipt: { findUnique: vi.fn() } } }));
import { prisma } from "@/lib/db";
import { receiptVerifyUrl } from "./receipt-verify";
import { getVerifiedReceipt } from "./verified-receipt";

const db = vi.mocked(prisma, true) as any;
const row = (status = "SUCCESS") => ({ receiptNumber: "REC-2026-000001", student: { fullName: "Ama Boateng" }, payment: { status } });
const goodToken = () => new URL(receiptVerifyUrl("REC-2026-000001")!).searchParams.get("t")!;

beforeEach(() => { vi.clearAllMocks(); process.env.AUTH_SECRET = "s"; process.env.NEXT_PUBLIC_APP_URL = "https://pay.example.com"; });

describe("getVerifiedReceipt", () => {
  it("returns the receipt for a correctly signed link", async () => {
    db.receipt.findUnique.mockResolvedValue(row());
    expect((await getVerifiedReceipt("REC-2026-000001", goodToken()))?.student.fullName).toBe("Ama Boateng");
  });
  it("never touches the database for a missing or wrong signature", async () => {
    expect(await getVerifiedReceipt("REC-2026-000001", undefined)).toBeNull();
    expect(await getVerifiedReceipt("REC-2026-000001", "wrong")).toBeNull();
    expect(db.receipt.findUnique).not.toHaveBeenCalled();
  });
  it("returns null for an unknown receipt or one whose payment is no longer successful", async () => {
    db.receipt.findUnique.mockResolvedValue(null);
    expect(await getVerifiedReceipt("REC-2026-000001", goodToken())).toBeNull();
    db.receipt.findUnique.mockResolvedValue(row("REFUNDED"));
    expect(await getVerifiedReceipt("REC-2026-000001", goodToken())).toBeNull();
  });
});
