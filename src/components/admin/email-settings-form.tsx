"use client";
import { FormEvent, useEffect, useState } from "react";

type Config = { provider: "MOCK" | "BREVO"; senderName: string; senderEmail: string; subject: string; messageTemplate: string; hasApiKey: boolean; enabled: boolean };

export function EmailSettingsForm() {
  const [config, setConfig] = useState<Config | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/email-settings").then(r => r.json()).then(d => d.config ? setConfig(d.config) : (setOk(false), setMessage(d.error || "Unable to load email settings"))).catch(() => (setOk(false), setMessage("Unable to load email settings")));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault(); if (!config) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/admin/email-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...config, apiKey }) });
      const d = await r.json().catch(() => ({}));
      setOk(r.ok); setMessage(r.ok ? "Email settings saved." : d.error || "Save failed");
      if (r.ok) { setConfig(d.config); setApiKey(""); }
    } catch {
      setOk(false); setMessage("Network error - settings were not saved.");
    } finally {
      setBusy(false);
    }
  }

  if (!config) return <p className="text-portal-muted">{message || "Loading…"}</p>;
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig({ ...config, [k]: v });
  const live = config.provider === "BREVO";

  return (
    <section className="portal-card-glass max-w-2xl p-6">
      <h2 className="mb-1 text-xl font-semibold text-portal-text">Email receipts</h2>
      <p className="mb-5 text-sm text-portal-muted">After a successful payment the student is emailed their receipt with the PDF attached. Failed sends appear under Delivery log.</p>
      <form onSubmit={save} className="space-y-4">
        <label className="flex items-center gap-3 text-sm text-portal-text"><input type="checkbox" checked={config.enabled} onChange={e => set("enabled", e.target.checked)} className="h-4 w-4" />Send email receipts</label>
        <label className="block text-sm text-portal-muted">Email provider
          <select value={config.provider} onChange={e => set("provider", e.target.value as Config["provider"])} className="portal-input mt-1">
            <option value="BREVO">Brevo</option>
            <option value="MOCK">Test mode (logs only, sends nothing)</option>
          </select>
        </label>
        {live && <label className="block text-sm text-portal-muted">Brevo API key {config.hasApiKey ? <span className="text-emerald-700">(saved - leave blank to keep it)</span> : <span className="text-amber-600">(not saved yet)</span>}
          <input type="password" autoComplete="new-password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="portal-input mt-1" />
          <span className="mt-1 block text-xs text-portal-muted">Brevo dashboard &gt; SMTP &amp; API &gt; API keys (the v3 API key, not the SMTP password).</span>
        </label>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-portal-muted">Sender name <span>(shown in the inbox)</span>
            <input value={config.senderName} maxLength={70} onChange={e => set("senderName", e.target.value)} placeholder="UMaT SRC" className="portal-input mt-1" />
          </label>
          <label className="block text-sm text-portal-muted">Sender email
            <input type="email" value={config.senderEmail} onChange={e => set("senderEmail", e.target.value)} placeholder="receipts@your-domain.com" className="portal-input mt-1" />
          </label>
        </div>
        {live && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The sender email must be on a domain you have verified in Brevo (Senders, Domains &amp; Dedicated IPs &gt; Domains), otherwise Brevo rejects the send and receipts land in spam. Also turn off IP blocking in Brevo (Security &gt; Authorised IPs), because Vercel&apos;s IP addresses change.
        </p>}
        <label className="block text-sm text-portal-muted">Subject
          <input value={config.subject} maxLength={150} onChange={e => set("subject", e.target.value)} className="portal-input mt-1" />
        </label>
        <label className="block text-sm text-portal-muted">Message
          <textarea rows={9} value={config.messageTemplate} onChange={e => set("messageTemplate", e.target.value)} className="portal-input mt-1" />
          <span className="mt-1 block text-xs text-portal-muted">Placeholders (subject and message): {"{name}"} {"{reference}"} {"{items}"} {"{amount}"} {"{receipt}"}</span>
        </label>
        {message && <p className={`text-sm ${ok ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
        <button disabled={busy} className="portal-btn-primary">{busy ? "Saving…" : "Save email settings"}</button>
      </form>
    </section>
  );
}
