import { describe, expect, it } from "vitest";
import { generateReceiptPdf } from "./receipts-pdf";

const base = {
  receiptNumber: "REC-2026-000001",
  issuedAt: new Date("2026-10-09T10:00:00Z"),
  student: { fullName: "Kwame Mensah", referenceNumber: "UMaT/2026/001" },
};
describe("receipt pdf", () => {
  it("renders an itemised receipt", async () => {
    const bytes = await generateReceiptPdf({ ...base, payment: { internalReference: "PAY-1-ABC", currency: "GHS", amount: 860, provider: "PAYSTACK", paidAt: new Date(), items: [
      { label: "Standard A3 Drawing Board + Set Square + Engineering Set + A3 Drawing Sheet", amount: 400 },
      { label: "Hard Steel-Toed Safety Boots", amount: 300 }, { label: "Safety Helmet", amount: 60 },
      { label: "Reflector Vest", amount: 50 }, { label: "Safety Goggles", amount: 45 }, { label: "Earplugs", amount: 5 } ] } });
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
  });
  it("survives names outside the standard PDF character set", async () => {
    const bytes = await generateReceiptPdf({ ...base, student: { ...base.student, fullName: "Kofi Ɔpoku Ɛkow \u2019s" }, payment: { internalReference: "PAY-2", currency: "GHS", amount: 5, provider: "PAYSTACK", paidAt: null, items: [] } });
    expect(bytes.length).toBeGreaterThan(500);
  });
});

describe("receipt pdf signatories", () => {
  // 1x1 transparent PNG
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const payment = { internalReference: "PAY-3", currency: "GHS", amount: 60, provider: "PAYSTACK", paidAt: null, items: [{ label: "Safety Helmet", amount: 60 }] };
  it("renders with a President and Treasurer", async () => {
    const bytes = await generateReceiptPdf({ ...base, payment, signatories: { president: { name: "Ama Boateng", signatureUrl: png }, treasurer: { name: "Obed Tandoh", signatureUrl: png } } });
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
  });
  it("ignores a corrupt signature instead of failing", async () => {
    const bytes = await generateReceiptPdf({ ...base, payment, signatories: { president: { name: "Ama Boateng", signatureUrl: "data:image/png;base64,AAAA" }, treasurer: null } });
    expect(bytes.length).toBeGreaterThan(500);
  });
});
