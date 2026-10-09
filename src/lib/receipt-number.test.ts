import { describe, expect, it } from "vitest";
import { nextReceiptNumber } from "./receipt-number";
describe("nextReceiptNumber", () => {
  it("starts at 000001", () => expect(nextReceiptNumber([], 2026)).toBe("REC-2026-000001"));
  it("is one more than the highest, never a count (a deleted receipt can't cause a repeat)", () => {
    expect(nextReceiptNumber(["REC-2026-000001", "REC-2026-000003"], 2026)).toBe("REC-2026-000004");
  });
  it("ignores older-style numbers and other years", () => {
    expect(nextReceiptNumber(["REC-2026-PAY-1728450000000-ABC", "REC-2025-000099"], 2026)).toBe("REC-2026-000001");
  });
});
