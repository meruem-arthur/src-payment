"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Status() {
  const params = useSearchParams();
  return (
    <main className="portal-shell flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="portal-content portal-card w-full max-w-md space-y-3 p-8">
        <div className="portal-logos">
          <div className="portal-crest">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/school-crest.png" alt="University of Mines and Technology crest" /></div>
          <div className="portal-crest">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/src-logo.png" alt="SRC logo" /></div>
        </div>
        <h1 className="text-2xl font-bold text-portal-text">Payment submitted</h1>
        <p className="text-sm text-portal-muted">Your payment is being verified by the payment provider. Please wait for your confirmation before trying again.</p>
        <p className="break-all text-xs text-portal-muted">Reference: {params.get("ref") || "Not available"}</p>
        <a href="/" className="portal-btn-primary inline-block">Return to payment portal</a>
      </div>
    </main>
  );
}
export default function PaymentStatus() { return <Suspense fallback={null}><Status /></Suspense>; }
