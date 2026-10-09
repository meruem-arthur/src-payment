"use client";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { AdminShell } from "@/components/admin/admin-shell";

type Payment = {
  id: string;
  internalReference: string;
  amount: string | number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  student: { fullName: string; referenceNumber: string; phone: string; email: string | null };
  receipt: { receiptNumber: string } | null;
};

// After "Settings saved securely." shows, return to the payment records by itself.
const SETTINGS_AUTO_CLOSE_MS = 1500;

export default function AdminDashboard() {
  const { data: session } = useSession();
  const isSuper = (session?.user as any)?.role === "SUPER_ADMIN";
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"payments" | "settings">("payments");
  const [config, setConfig] = useState<any>({ provider: "PAYSTACK", environment: "TEST", publicKey: "", secretKey: "", webhookSecret: "", configValue: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/payments").then((r) => r.json()).then((d) => (d.error ? setError(d.error) : setData(d))).catch(() => setError("Unable to load payment records"));
    fetch("/api/admin/settings").then((r) => r.json()).then((d) => {
      if (d.config) setConfig((c: any) => ({ ...c, ...d.config, secretKey: "", webhookSecret: "" }));
    }).catch(() => {});
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  async function save(e: any) {
    e.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const r = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      const d = await r.json();
      if (!r.ok) { setMessage(d.error || "Save failed"); return; }
      setMessage("Settings saved securely.");
      setConfig((c: any) => ({ ...c, secretKey: "", webhookSecret: "" }));
      closeTimer.current = setTimeout(() => { setTab("payments"); setMessage(""); }, SETTINGS_AUTO_CLOSE_MS);
    } finally {
      setSaving(false);
    }
  }

  const stats = data?.stats;
  const tabClass = (active: boolean) => (active ? "portal-btn-primary" : "portal-btn-ghost");
  const statusClass = (s: string) => (s === "SUCCESS" ? "text-emerald-700" : s === "FAILED" ? "text-red-600" : "text-amber-600");

  return (
    <AdminShell
      eyebrow="Payment administration"
      title="Dashboard"
      subtitle={`Signed in as ${session?.user?.name || session?.user?.email || ""}`}
      actions={
        <>
          {isSuper && <a href="/admin/users" className="portal-btn-ghost">Manage admins</a>}
          <button onClick={() => signOut({ callbackUrl: "/admin/login" })} className="portal-btn-ghost">Sign out</button>
        </>
      }
    >
      <nav className="flex gap-3">
        <button onClick={() => setTab("payments")} className={tabClass(tab === "payments")}>Payment records</button>
        {isSuper && <button onClick={() => setTab("settings")} className={tabClass(tab === "settings")}>Payment settings</button>}
      </nav>

      {tab === "payments" ? (
        <>
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total transactions", stats?.count ?? "—"],
              ["Successful", stats?.successful ?? "—"],
              ["Pending", stats?.pending ?? "—"],
              ["Revenue", `GH₵ ${Number(stats?.revenue || 0).toFixed(2)}`],
            ].map(([label, value]) => (
              <div key={String(label)} className="portal-card-glass p-5">
                <p className="text-sm text-portal-muted">{label}</p>
                <p className="mt-2 text-2xl font-bold text-portal-text">{value}</p>
              </div>
            ))}
          </section>

          <section className="portal-card-glass p-5">
            <h2 className="mb-4 text-lg font-semibold text-portal-text">Transaction status</h2>
            {([
              ["Successful", Number(stats?.successful || 0), "bg-emerald-500"],
              ["Pending", Number(stats?.pending || 0), "bg-amber-500"],
              ["Failed", Number(stats?.failed || 0), "bg-rose-500"],
            ] as [string, number, string][]).map(([label, value, color]) => (
              <div key={label} className="mb-3 last:mb-0">
                <div className="mb-1 flex justify-between text-sm text-portal-text"><span>{label}</span><span>{value}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-black/10">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (value / Math.max(1, Number(stats?.count || 0))) * 100)}%` }} />
                </div>
              </div>
            ))}
          </section>

          <section className="portal-card-glass overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm text-portal-text">
              <thead className="border-b border-black/10 text-portal-muted">
                <tr>{["Student", "Reference", "Phone", "Items", "Amount", "Status", "Date", "Receipt"].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {(data?.payments || []).map((p: Payment) => (
                  <tr key={p.id} className="border-b border-black/5">
                    <td className="p-3">{p.student.fullName}<div className="text-xs text-portal-muted">{p.student.email}</div></td>
                    <td className="p-3">{p.student.referenceNumber}</td>
                    <td className="p-3">{p.student.phone}</td>
                    <td className="p-3">{Array.isArray((p as any).items) ? (p as any).items.map((i: any) => i.label).join(", ") : "—"}</td>
                    <td className="p-3">{p.currency} {Number(p.amount).toFixed(2)}</td>
                    <td className="p-3"><span className={`font-semibold ${statusClass(p.status)}`}>{p.status}</span></td>
                    <td className="p-3">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="p-3">{p.receipt?.receiptNumber || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.payments?.length && <p className="p-8 text-center text-portal-muted">No payments recorded yet.</p>}
          </section>
        </>
      ) : (
        <section className="portal-card-glass max-w-2xl p-6">
          <h2 className="mb-5 text-xl font-semibold text-portal-text">System-wide payment provider</h2>
          <form onSubmit={save} className="space-y-4">
            <label className="block text-sm text-portal-muted">Provider
              <select value={config.provider} onChange={(e) => setConfig({ ...config, provider: e.target.value })} className="portal-input mt-1"><option value="PAYSTACK">Paystack</option></select>
            </label>
            <label className="block text-sm text-portal-muted">Environment
              <select value={config.environment} onChange={(e) => setConfig({ ...config, environment: e.target.value })} className="portal-input mt-1"><option value="TEST">Test</option><option value="LIVE">Live</option></select>
            </label>
            <label className="block text-sm text-portal-muted">Public key
              <input value={config.publicKey || ""} onChange={(e) => setConfig({ ...config, publicKey: e.target.value })} className="portal-input mt-1" />
            </label>
            <label className="block text-sm text-portal-muted">Secret key (leave blank to keep existing)
              <input type="password" autoComplete="new-password" value={config.secretKey || ""} onChange={(e) => setConfig({ ...config, secretKey: e.target.value })} className="portal-input mt-1" />
            </label>
            <label className="block text-sm text-portal-muted">Webhook secret (leave blank to keep existing)
              <input type="password" autoComplete="new-password" value={config.webhookSecret || ""} onChange={(e) => setConfig({ ...config, webhookSecret: e.target.value })} className="portal-input mt-1" />
            </label>
            <label className="block text-sm text-portal-muted">Optional provider configuration / subaccount
              <input value={config.configValue || ""} onChange={(e) => setConfig({ ...config, configValue: e.target.value })} className="portal-input mt-1" />
            </label>
            {message && (
              <p role="status" className={`rounded-md border px-3 py-2 text-sm ${message.startsWith("Settings saved") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>{message}</p>
            )}
            <button disabled={saving} className="portal-btn-primary">{saving ? "Saving…" : "Save settings"}</button>
          </form>
        </section>
      )}
    </AdminShell>
  );
}
