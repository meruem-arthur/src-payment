import { waitUntil } from "@vercel/functions";
import { captureError } from "@/lib/monitoring/capture-error";

/**
 * Runs `task` after the HTTP response is sent so the Paystack webhook can
 * answer immediately while the SMS is still going out. On Vercel `waitUntil`
 * keeps the function alive until the task settles. Errors are reported here,
 * never thrown - a background task has no caller left to handle them.
 */
export function runInBackground(label: string, task: () => Promise<unknown>): Promise<void> {
  const promise = (async () => { try { await task(); } catch (err) { captureError(err, { context: label }); } })();
  try { waitUntil(promise); } catch { /* not inside a Vercel request context */ }
  return promise;
}
