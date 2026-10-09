import { describe, expect, it } from "vitest";
import { PRODUCTS, calculateTotal, validateProductSelection } from "./catalog";
describe("checkout catalogue", () => {
  it("rejects an empty selection", () => expect(validateProductSelection([])).toBeNull());
  it("rejects unknown product ids", () => expect(validateProductSelection(["NOT_A_PRODUCT"])).toBeNull());
  it("rejects duplicate selections", () => expect(validateProductSelection(["HELMET", "HELMET"])).toBeNull());
  it("calculates totals from the server catalogue", () => expect(calculateTotal(["HELMET", "GOGGLES"])).toBe(105));
  it("full set totals GHS 860 (drawing set 390 + earplugs 15)", () => expect(calculateTotal(Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[])).toBe(860));
});
describe("prices", () => {
  it("uses the agreed prices", () => { expect(PRODUCTS.DRAWING_BOARD.amount).toBe(390); expect(PRODUCTS.EARPLUGS.amount).toBe(15); });
});
