import { describe, expect, it } from "vitest";
import { calculateTotal, validateProductSelection } from "./catalog";
describe("checkout catalogue", () => {
  it("rejects an empty selection", () => expect(validateProductSelection([])).toBeNull());
  it("rejects unknown product ids", () => expect(validateProductSelection(["NOT_A_PRODUCT"])).toBeNull());
  it("rejects duplicate selections", () => expect(validateProductSelection(["HELMET", "HELMET"])).toBeNull());
  it("calculates totals from the server catalogue", () => expect(calculateTotal(["HELMET", "GOGGLES"])).toBe(105));
});
