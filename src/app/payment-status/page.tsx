"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Info = { status: string; receiptNumber: string | null } | null;

function Status() {
  const params = useSearchParams();
  const ref = params.get("ref");
  const [info, setInfo] = useState<Info>(null);
  const [tries, setTries] = useState(0);

  // The payment is confirmed by Paystack's webhook, not by this browser
  // redirect - so keep checking for a couple of minutes until it lands.
  useEffect(() => {
    if (!ref) return;
    let stop = false;
    async function check() {
      try {
        const r = await fetch(`/api/payments/status?ref=${encodeURIComponent(ref!)}`, { cache: "no-store" });
        if (r.ok && !stop) setInfo(await r.json());
      } catch { /* try again on the next tick */ }
      if (!stop) setTries(t => t + 1);
    }
    check();
    const id = setInterval(() => { if (!stop) check(); }, 4000);
    return () => { stop = true; clearInterval(id); };
  }, [ref]);

  const status = info?.status;
  const done = status === "SUCCESS" && info?.receiptNumber;
  const failed = status === "FAILED" || status === "CANCELLED";
  const waiting = !done && !failed;

  return (
    <main className="portal-shell flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="portal-content portal-card w-full max-w-md space-y-3 p-8">
        <div className="portal-logos">
          <div className="portal-crest">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/school-crest.png" alt="University of Mines and Technology crest" /></div>
          <div className="portal-crest">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/src-logo.png" alt="SRC logo" /></div>
        </div>
        {done ? <>
          <h1 className="text-2xl font-bold text-portal-text">Payment confirmed</h1>
          <p className="text-sm text-portal-muted">Thank you. Your receipt number is <strong>{info!.receiptNumber}</strong>. A confirmation SMS is on its way to your phone.</p>
          <a href={`/api/receipts/download?ref=${encodeURIComponent(ref!)}`} className="portal-btn-primary inline-block">Download receipt (PDF)</a>
        </> : failed ? <>
          <h1 className="text-2xl font-bold text-portal-text">Payment not completed</h1>
          <p className="text-sm text-portal-muted">The payment was not successful and you have not been charged for this attempt. You can go back and try again.</p>
        </> : <>
          <h1 className="text-2xl font-bold text-portal-text">Payment submitted</h1>
          <p className="text-sm text-portal-muted">{tries > 30 ? "This is taking longer than usual. Your receipt will be texted to you once the payment is confirmed - please don't pay again." : "We are confirming your payment with the payment provider. This page updates automatically."}</p>
        </>}
        <p className="break-all text-xs text-portal-muted">Reference: {ref || "Not available"}</p>
        {!waiting && <a href="/" className="portal-btn-secondary inline-block">Back to payment portal</a>}
        {waiting && <a href="/" className="text-xs text-portal-muted underline">Return to payment portal</a>}
      </div>
    </main>
  );
}
export default function PaymentStatus() { return <Suspense fallback={null}><Status /></Suspense>; }
