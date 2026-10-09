"use client";
import { FormEvent, useEffect, useState } from "react";

type Config = { provider: "MOCK" | "ARKESEL" | "AFRICASTALKING"; senderId: string; messageTemplate: string; username: string; hasApiKey: boolean; enabled: boolean };

export function SmsSettingsForm() {
  const [config, setConfig] = useState<Config | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/sms-settings").then(r => r.json()).then(d => d.config ? setConfig(d.config) : (setOk(false), setMessage(d.error || "Unable to load SMS settings"))).catch(() => (setOk(false), setMessage("Unable to load SMS settings")));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault(); if (!config) return;
    setBusy(true); setMessage("");
    const r = await fetch("/api/admin/sms-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...config, apiKey }) });
    const d = await r.json();
    setOk(r.ok); setMessage(r.ok ? "SMS settings saved." : d.error || "Save failed");
    if (r.ok) { setConfig(d.config); setApiKey(""); }
    setBusy(false);
  }

  if (!config) return <p className="text-portal-muted">{message || "Loading…"}</p>;
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig({ ...config, [k]: v });
  const isAT = config.provider === "AFRICASTALKING";

  return (
    <section className="portal-card-glass max-w-2xl p-6">
      <h2 className="mb-1 text-xl font-semibold text-portal-text">SMS notifications</h2>
      <p className="mb-5 text-sm text-portal-muted">Students get a confirmation text after a successful payment. Add your SMS provider details below.</p>
      <form onSubmit={save} className="space-y-4">
        <label className="flex items-center gap-3 text-sm text-portal-text"><input type="checkbox" checked={config.enabled} onChange={e => set("enabled", e.target.checked)} className="h-4 w-4" />Send SMS confirmations</label>
        <label className="block text-sm text-portal-muted">SMS provider
          <select value={config.provider} onChange={e => set("provider", e.target.value as Config["provider"])} className="portal-input mt-1">
            <option value="ARKESEL">Arkesel</option>
            <option value="AFRICASTALKING">Africa&apos;s Talking</option>
            <option value="MOCK">Test mode (logs only, sends nothing)</option>
          </select>
        </label>
        {config.provider !== "MOCK" && <>
          <label className="block text-sm text-portal-muted">API key {config.hasApiKey ? <span className="text-emerald-700">(saved - leave blank to keep it)</span> : <span className="text-amber-600">(not saved yet)</span>}
            <input type="password" autoComplete="new-password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="portal-input mt-1" />
          </label>
          {isAT && <label className="block text-sm text-portal-muted">Username <span className="text-portal-muted">(&quot;sandbox&quot; while testing)</span>
            <input value={config.username} onChange={e => set("username", e.target.value)} className="portal-input mt-1" />
          </label>}
          <label className="block text-sm text-portal-muted">Sender ID <span className="text-portal-muted">(up to 11 letters/numbers, must be approved by your provider)</span>
            <input value={config.senderId} maxLength={11} onChange={e => set("senderId", e.target.value.replace(/[^A-Za-z0-9]/g, ""))} placeholder={isAT ? "Leave blank to use your account default" : "e.g. UMaTSRC"} className="portal-input mt-1" />
          </label>
        </>}
        <label className="block text-sm text-portal-muted">Message template
          <textarea rows={5} value={config.messageTemplate} onChange={e => set("messageTemplate", e.target.value)} className="portal-input mt-1" />
          <span className="mt-1 block text-xs text-portal-muted">Placeholders: {"{name}"} {"{reference}"} {"{items}"} {"{amount}"} {"{receipt}"}</span>
        </label>
        {message && <p className={`text-sm ${ok ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
        <button disabled={busy} className="portal-btn-primary">{busy ? "Saving…" : "Save SMS settings"}</button>
      </form>
    </section>
  );
}
