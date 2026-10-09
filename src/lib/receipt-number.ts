/**
 * Next receipt number: REC-<year>-<6 digits>, one higher than the highest
 * number already issued this year. Anything that doesn't match that exact
 * shape (older-style numbers) is ignored. Using the highest number rather than
 * a count means a deleted receipt can never cause a number to be reused.
 */
export function nextReceiptNumber(existing: string[], year = new Date().getFullYear()): string {
  const shape = new RegExp(`^REC-${year}-(\\d+)$`);
  let highest = 0;
  for (const n of existing) {
    const m = shape.exec(n);
    if (m) highest = Math.max(highest, parseInt(m[1], 10));
  }
  return `REC-${year}-${String(highest + 1).padStart(6, "0")}`;
}
