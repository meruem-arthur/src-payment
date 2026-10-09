"use client";

import { useMemo, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

const PRODUCTS = [
  { id: "DRAWING_BOARD", label: "Drawing Board", amount: 390 },
  { id: "SAFETY_BOOT", label: "Safety Boot", amount: 300 },
  { id: "HELMET", label: "Helmet", amount: 60 },
  { id: "GOGGLES", label: "Goggles", amount: 45 },
  { id: "EARPLUGS", label: "Earplugs", amount: 15 },
  { id: "VEST", label: "Safety Vest", amount: 50 },
] as const;

export function SrcPaymentForm() {
  const [fullName, setFullName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => PRODUCTS.filter((p) => selected.includes(p.id)).reduce((sum, p) => sum + p.amount, 0),
    [selected]
  );

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !referenceNumber.trim() || !phone.trim()) {
      setError("Please complete your name, reference number and phone number.");
      return;
    }
    if (selected.length === 0) {
      setError("Select at least one item before continuing.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          referenceNumber,
          phone,
          email: email || undefined,
          items: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start payment.");
        return;
      }
      window.location.href = data.authorizationUrl;
    } catch {
      setError("Could not connect to the payment system. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="portal-card space-y-6 p-5 sm:p-7">
      <div>
        <h2 className="text-xl font-bold text-portal-text">Your Details</h2>
        <p className="mt-1 text-sm text-portal-muted">No account or registration is required.</p>
      </div>

      {error && <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-portal-text">Full Name</span>
          <input required className="portal-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Mensah" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-portal-text">Student ID / Reference No.</span>
          <input required className="portal-input" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="e.g. 20231234" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-portal-text">Phone Number</span>
          <input required type="tel" className="portal-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024..." />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-portal-text">Email <span className="font-normal text-portal-muted">(optional)</span></span>
          <input type="email" className="portal-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
      </div>

      <div>
        <h2 className="text-xl font-bold text-portal-text">Select What You Are Paying For</h2>
        <p className="mt-1 text-sm text-portal-muted">Choose all items you need. The server calculates the final amount.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PRODUCTS.map((product) => {
            const checked = selected.includes(product.id);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => toggle(product.id)}
                className={`flex items-center justify-between rounded-lg border p-4 text-left transition ${
                  checked ? "border-portal-accent bg-portal-accent/10" : "border-portal-border"
                }`}
                aria-pressed={checked}
              >
                <span>
                  <span className="block font-semibold text-portal-text">{product.label}</span>
                  <span className="text-xs text-portal-muted">{checked ? "Selected" : "Tap to select"}</span>
                </span>
                <span className="font-bold text-portal-text">GHS {product.amount}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-portal-border p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-portal-text">Total to Pay</span>
          <span className="text-2xl font-extrabold text-portal-accent">GHS {total.toLocaleString()}</span>
        </div>
        <p className="mt-2 text-xs text-portal-muted">
          Drawing board + all PPE items = GHS 860.
        </p>
      </div>

      <button type="submit" disabled={loading || total === 0} className="portal-btn-primary flex w-full items-center justify-center gap-2">
        {loading && <Spinner />}
        {loading ? "Opening Paystack..." : `Continue to Pay GHS ${total.toLocaleString()}`}
      </button>
    </form>
  );
}
