import type { Metadata } from "next";
import { getVerifiedReceipt } from "@/lib/verified-receipt";

// Always fresh, never indexed: this page confirms a specific receipt is genuine.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify receipt", robots: { index: false, follow: false } };

type Item = { label: string; amount: number };
const items = (v: unknown): Item[] => (Array.isArray(v) ? v.filter((i): i is Item => !!i && typeof i.label === "string" && typeof i.amount === "number") : []);
const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Accra" });

export default async function VerifyReceipt({ params, searchParams }: { params: { receiptNumber: string }; searchParams: { t?: string } }) {
  const receiptNumber = decodeURIComponent(params.receiptNumber);
  const receipt = await getVerifiedReceipt(receiptNumber, searchParams.t);
  const valid = receipt !== null;

  return (
    <main className="portal-shell flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="portal-content portal-card w-full max-w-md space-y-3 p-8">
        <div className="portal-logos">
          <div className="portal-crest">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/school-crest.png" alt="University of Mines and Technology crest" /></div>
          <div className="portal-crest">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/src-logo.png" alt="SRC logo" /></div>
        </div>
        {valid && receipt ? (
          <>
            <h1 className="text-2xl font-bold text-emerald-700">✓ Valid receipt</h1>
            <p className="text-sm text-portal-muted">This receipt was issued by the SRC payment portal.</p>
            <dl className="space-y-2 text-left text-sm text-portal-text">
              {([
                ["Receipt No.", receipt.receiptNumber],
                ["Date issued", fmt(receipt.issuedAt)],
                ["Student", receipt.student.fullName],
                ["Reference No.", receipt.student.referenceNumber],
                ["Amount paid", `${receipt.payment.currency} ${Number(receipt.payment.amount).toFixed(2)}`],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-black/10 pb-1"><dt className="text-portal-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
              ))}
              {items(receipt.payment.items).length > 0 && (
                <div><dt className="text-portal-muted">Items</dt><dd className="font-semibold">{items(receipt.payment.items).map((i) => i.label).join(", ")}</dd></div>
              )}
            </dl>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-red-600">Receipt not verified</h1>
            <p className="text-sm text-portal-muted">We could not confirm this receipt. Scan the QR code printed on the original receipt, and contact the SRC if you think this is a mistake.</p>
          </>
        )}
        <a href="/" className="portal-btn-secondary inline-block">Back to payment portal</a>
      </div>
    </main>
  );
}
