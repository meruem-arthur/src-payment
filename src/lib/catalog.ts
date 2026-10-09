// Checkout catalogue - item names follow the SRC "Breakdown of the Personal
// Protective Equipment (PPEs) and Drawing Board with Engineering Set" sheet
// (ref SRC/OT/001). This is the ONLY place prices are defined: the checkout
// page, the payment API, receipts and SMS all read from here.
//
// `short` is the compact name used where space is tight (SMS).
export const PRODUCTS = {
  DRAWING_BOARD: { label: "Standard A3 Drawing Board + Set Square + Engineering Set + A3 Drawing Sheet", short: "A3 Drawing Board Set", amount: 390 },
  SAFETY_BOOT: { label: "Hard Steel-Toed Safety Boots", short: "Safety Boots", amount: 300 },
  HELMET: { label: "Safety Helmet", short: "Safety Helmet", amount: 60 },
  VEST: { label: "Reflector Vest", short: "Reflector Vest", amount: 50 },
  GOGGLES: { label: "Safety Goggles", short: "Safety Goggles", amount: 45 },
  EARPLUGS: { label: "Earplugs", short: "Earplugs", amount: 15 },
} as const;
export type ProductId = keyof typeof PRODUCTS;
export function validateProductSelection(items: unknown): ProductId[] | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const valid = items.filter((id): id is ProductId => typeof id === "string" && Object.prototype.hasOwnProperty.call(PRODUCTS, id));
  const unique = [...new Set(valid)];
  return unique.length > 0 && unique.length === items.length ? unique : null;
}
export function calculateTotal(ids: ProductId[]) { return ids.reduce((sum, id) => sum + PRODUCTS[id].amount, 0); }
