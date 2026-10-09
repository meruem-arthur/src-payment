"use client";
import { useState } from "react";

type Delivery = { status: "PENDING" | "SENT" | "FAILED"; createdAt: string; errorMessage: string | null } | null;

function Last({ label, d }: { label: string; d: Delivery }) {
  if (!d) return <div className="text-xs text-portal-muted">{label}: not sent yet</div>;
  const color = d.status === "SENT" ? "text-emerald-700" : d.status === "FAILED" ? "text-red-600" : "text-amber-600";
  return (
    <div className="text-xs text-portal-muted" title={d.errorMessage || undefined}>
      {label}: <span className={`font-semibold ${color}`}>{d.status === "SENT" ? "Sent" : d.status === "FAILED" ? "Failed" : "Pending"}</span> · {new Date(d.createdAt).toLocaleString()}
    </div>
  );
}

/** Last SMS / email status for a payment, with Resend buttons for successful payments. */
export function PaymentMessages({ paymentId, canResend, lastSms, lastEmail, onDone }: { paymentId: string; canResend: boolean; lastSms: Delivery; lastEmail: Delivery; onDone: () => Promise<unknown> | void }) {
  const [busy, setBusy] = useState<"SMS" | "EMAIL" | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function resend(channel: "SMS" | "EMAIL") {
    setBusy(channel);
    setNote(null);
    try {
      const r = await fetch(`/api/admin/payments/${paymentId}/resend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
      const d = await r.json().catch(() => ({}));
      setNote(r.ok ? { ok: true, text: `${channel === "SMS" ? "SMS" : "Email"} sent.` } : { ok: false, text: d.error || "Could not resend" });
      await onDone();
    } catch {
      setNote({ ok: false, text: "Could not resend" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1">
      <Last label="SMS" d={lastSms} />
      <Last label="Email" d={lastEmail} />
      {canResend && (
        <div className="flex gap-2 pt-1">
          <button type="button" disabled={busy !== null} onClick={() => resend("SMS")} className="portal-btn-ghost !px-3 !py-1 text-xs">{busy === "SMS" ? "Sending…" : "Resend SMS"}</button>
          <button type="button" disabled={busy !== null} onClick={() => resend("EMAIL")} className="portal-btn-ghost !px-3 !py-1 text-xs">{busy === "EMAIL" ? "Sending…" : "Resend email"}</button>
        </div>
      )}
      {note && <p role="status" className={`text-xs ${note.ok ? "text-emerald-700" : "text-red-600"}`}>{note.text}</p>}
    </div>
  );
}
