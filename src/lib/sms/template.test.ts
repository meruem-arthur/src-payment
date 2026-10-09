import { describe, expect, it } from "vitest";
import { renderSmsTemplate } from "./template";
describe("renderSmsTemplate", () => {
  it("fills every placeholder, including repeats", () => {
    const out = renderSmsTemplate("{name}|{reference}|{items}|GHS {amount}|{receipt}|{name}", { name: "Ama", reference: "R1", items: "Helmet", amount: "60", receipt: "REC-2026-000001" });
    expect(out).toBe("Ama|R1|Helmet|GHS 60|REC-2026-000001|Ama");
  });
});
