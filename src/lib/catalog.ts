export const PRODUCTS = {
  DRAWING_BOARD: { label: "Drawing Board", amount: 390 },
  SAFETY_BOOT: { label: "Safety Boot", amount: 300 },
  HELMET: { label: "Safety Helmet", amount: 60 },
  GOGGLES: { label: "Safety Goggles", amount: 45 },
  EARPLUGS: { label: "Earplugs", amount: 15 },
  VEST: { label: "Safety Vest", amount: 50 },
} as const;
export type ProductId = keyof typeof PRODUCTS;
export function validateProductSelection(items: unknown): ProductId[] | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const valid = items.filter((id): id is ProductId => typeof id === "string" && Object.prototype.hasOwnProperty.call(PRODUCTS, id));
  const unique = [...new Set(valid)];
  return unique.length > 0 && unique.length === items.length ? unique : null;
}
export function calculateTotal(ids: ProductId[]) { return ids.reduce((sum, id) => sum + PRODUCTS[id].amount, 0); }
