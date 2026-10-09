const buckets = new Map<string, { count: number; resetAt: number }>();
export function getClientIpFromHeaderRecord(headers?: Record<string, string | string[] | undefined>) {
  const forwarded = headers?.["x-forwarded-for"];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || "unknown";
}
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number) {
  const now = Date.now(); let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) { bucket = { count: 0, resetAt: now + windowMs }; buckets.set(key, bucket); }
  bucket.count++;
  return { allowed: bucket.count <= maxAttempts, remaining: Math.max(0, maxAttempts - bucket.count), resetAt: bucket.resetAt };
}
