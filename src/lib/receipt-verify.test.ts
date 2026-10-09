import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isValidVerifyToken, receiptVerifyUrl } from "./receipt-verify";

const env = { ...process.env };
beforeEach(() => { process.env.AUTH_SECRET = "test-secret"; process.env.NEXT_PUBLIC_APP_URL = "https://pay.example.com/"; });
afterEach(() => { process.env = { ...env }; });
const tokenOf = (url: string) => new URL(url).searchParams.get("t");

describe("receipt verification links", () => {
  it("builds a link on the app's public URL whose token verifies for that receipt", () => {
    const url = receiptVerifyUrl("REC-2026-000001")!;
    expect(url.startsWith("https://pay.example.com/verify/REC-2026-000001?t=")).toBe(true);
    expect(isValidVerifyToken("REC-2026-000001", tokenOf(url))).toBe(true);
  });
  it("rejects a token used on a different receipt number (no walking through receipts)", () => {
    const t = tokenOf(receiptVerifyUrl("REC-2026-000001")!);
    expect(isValidVerifyToken("REC-2026-000002", t)).toBe(false);
  });
  it("rejects missing, empty, wrong-length and tampered tokens", () => {
    const t = tokenOf(receiptVerifyUrl("REC-2026-000001")!)!;
    for (const bad of [undefined, null, "", "abc", t.slice(0, -1), t.slice(0, -1) + (t.endsWith("0") ? "1" : "0")]) {
      expect(isValidVerifyToken("REC-2026-000001", bad)).toBe(false);
    }
  });
  it("a token made with another secret is rejected", () => {
    const t = tokenOf(receiptVerifyUrl("REC-2026-000001")!);
    process.env.AUTH_SECRET = "different-secret";
    expect(isValidVerifyToken("REC-2026-000001", t)).toBe(false);
  });
  it("returns no link when the public URL isn't configured, and never validates without AUTH_SECRET", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(receiptVerifyUrl("REC-2026-000001")).toBeNull();
    delete process.env.AUTH_SECRET;
    expect(isValidVerifyToken("REC-2026-000001", "a".repeat(24))).toBe(false);
  });
});
