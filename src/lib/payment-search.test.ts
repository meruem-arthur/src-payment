import { describe, it, expect } from "vitest";
import { latestDeliveries, paymentSearchWhere } from "./payment-search";

describe("paymentSearchWhere", () => {
  it("returns no filter for an empty or blank search", () => {
    expect(paymentSearchWhere(undefined)).toBeUndefined();
    expect(paymentSearchWhere("   ")).toBeUndefined();
  });
  it("matches name, reference number and receipt number, case-insensitively", () => {
    const where: any = paymentSearchWhere("20/1234");
    expect(where.AND).toHaveLength(1);
    expect(where.AND[0].OR).toEqual([
      { student: { fullName: { contains: "20/1234", mode: "insensitive" } } },
      { student: { referenceNumber: { contains: "20/1234", mode: "insensitive" } } },
      { receipt: { receiptNumber: { contains: "20/1234", mode: "insensitive" } } },
    ]);
  });
  it("requires every word to match, so first and last name can be typed in any order", () => {
    const where: any = paymentSearchWhere("  kwame   mensah ");
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR[0].student.fullName.contains).toBe("kwame");
    expect(where.AND[1].OR[0].student.fullName.contains).toBe("mensah");
  });
  it("caps very long searches", () => {
    const where: any = paymentSearchWhere("a ".repeat(100));
    expect(where.AND.length).toBeLessThanOrEqual(8);
  });
});

describe("latestDeliveries", () => {
  const d = (n: number) => new Date(2026, 9, n);
  it("keeps the newest SMS and newest email per payment (rows arrive newest first)", () => {
    const map = latestDeliveries([
      { relatedPaymentId: "p1", channel: "SMS", status: "FAILED", createdAt: d(3), errorMessage: "bad key" },
      { relatedPaymentId: "p1", channel: "SMS", status: "SENT", createdAt: d(2), errorMessage: null },
      { relatedPaymentId: "p1", channel: "EMAIL", status: "SENT", createdAt: d(1), errorMessage: null },
      { relatedPaymentId: null, channel: "SMS", status: "SENT", createdAt: d(1), errorMessage: null },
    ]);
    expect(map.get("p1")?.sms).toEqual({ status: "FAILED", createdAt: d(3), errorMessage: "bad key" });
    expect(map.get("p1")?.email?.status).toBe("SENT");
    expect(map.size).toBe(1);
  });
});
