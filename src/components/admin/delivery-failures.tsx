"use client";
import { useCallback, useEffect, useState } from "react";

type Failure = { id: string; channel: "SMS" | "EMAIL"; recipient: string; errorMessage: string | null; createdAt: string; student: { fullName: string; referenceNumber: string } | null };

export function DeliveryFailures() {
  const [rows, setRows] = useState<Failure[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError("");
    return fetch("/api/admin/notifications").then(r => r.json()).then(d => d.failures ? setRows(d.failures) : setError(d.error || "Unable to load delivery failures")).catch(() => setError("Unable to load delivery failures"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function markFixed(id: string) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/notifications/${id}/resolve`, { method: "POST" });
      if (!r.ok) setError((await r.json().catch(() => ({}))).error || "Could not update this entry");
      await load();
    } finally { setBusyId(null); }
  }

  return (
    <section className="portal-card-glass p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-portal-text">Delivery log</h2>
        <button onClick={load} className="portal-btn-ghost">Refresh</button>
      </div>
      <p className="mb-4 text-sm text-portal-muted">SMS and email receipts that failed to send. The payment and receipt are unaffected - the student can still download their PDF. Mark an entry fixed once you have dealt with it.</p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {!rows ? <p className="text-portal-muted">Loading…</p> : rows.length === 0 ? <p className="py-6 text-center text-portal-muted">No failed sends. 🎉</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm text-portal-text">
            <thead><tr>{["When", "Type", "Student", "Sent to", "Why it failed", ""].map(h => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(f => (
                <tr key={f.id} className="border-t border-portal-border align-top">
                  <td className="p-3 whitespace-nowrap">{new Date(f.createdAt).toLocaleString()}</td>
                  <td className="p-3">{f.channel === "EMAIL" ? "Email" : "SMS"}</td>
                  <td className="p-3">{f.student ? <>{f.student.fullName}<span className="block text-xs text-portal-muted">{f.student.referenceNumber}</span></> : "—"}</td>
                  <td className="p-3 break-all">{f.recipient}</td>
                  <td className="p-3 text-red-600">{f.errorMessage || "Unknown error"}</td>
                  <td className="p-3"><button disabled={busyId === f.id} onClick={() => markFixed(f.id)} className="portal-btn-ghost whitespace-nowrap">{busyId === f.id ? "…" : "Mark fixed"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
