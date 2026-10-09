import * as Sentry from "@sentry/nextjs";

/** Logs to the console and, when SENTRY_DSN is set, reports to Sentry. Never throws. */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  console.error(err);
  if (!process.env.SENTRY_DSN) return;
  try { Sentry.captureException(err, context ? { extra: context } : undefined); } catch { /* nothing safe left to do */ }
}
