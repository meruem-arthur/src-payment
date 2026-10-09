// A PENDING payment younger than this is treated as "possibly still in flight"
// and blocks a new attempt from the same student (see
// src/app/api/payments/initiate/route.ts). Older pending payments no longer
// block, so the student can retry.
export const PENDING_PAYMENT_STALE_AFTER_MS = 15 * 60 * 1000; // 15 minutes
