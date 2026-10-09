"use client";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { brandedQrDataUrl } from "@/lib/branded-qr";

type Config = { presidentName: string; presidentSignature: string | null; treasurerName: string; treasurerSignature: string | null };
type Who = "president" | "treasurer";

/** Shrinks an uploaded signature to a small PNG (keeps transparency) so it stays light in the database and on the PDF. */
function toSmallPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 600 / img.width, 240 / img.height);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a readable image")); };
    img.src = url;
  });
}

function PortalQr() {
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    setLink(url);
    brandedQrDataUrl(url).then(setQr).catch(() => setQr(""));
  }, []);
  return (
    <section className="portal-card-glass max-w-2xl p-6">
      <h2 className="mb-1 text-xl font-semibold text-portal-text">Portal QR code</h2>
      <p className="mb-4 text-sm text-portal-muted">Students scan this to open the payment page. Download it for posters, flyers or the class group.</p>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {qr ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={qr} alt="QR code for the payment portal" className="h-44 w-44 rounded-lg border border-black/10 bg-white p-2" /> : <div className="h-44 w-44 rounded-lg bg-black/5" />}
        <div className="min-w-0 space-y-3">
          <p className="break-all text-sm text-portal-text">{link}</p>
          <div className="flex flex-wrap gap-2">
            <a href={qr} download="src-payment-portal-qr.png" className={`portal-btn-primary inline-block ${qr ? "" : "pointer-events-none opacity-50"}`}>Download QR (PNG)</a>
            <button type="button" className="portal-btn-ghost" onClick={() => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? "Copied" : "Copy link"}</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReceiptSettingsForm() {
  const [config, setConfig] = useState<Config | null>(null);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(true);
  const [busy, setBusy] = useState(false);
  // Only signatures changed in this session are sent (undefined = keep, null = remove).
  const [sigChanges, setSigChanges] = useState<{ president?: string | null; treasurer?: string | null }>({});

  useEffect(() => {
    fetch("/api/admin/receipt-settings").then(r => r.json()).then(d => d.config ? setConfig(d.config) : (setOk(false), setMessage(d.error || "Unable to load receipt settings"))).catch(() => (setOk(false), setMessage("Unable to load receipt settings")));
  }, []);

  async function pick(who: Who, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !config) return;
    try {
      const png = await toSmallPng(file);
      setConfig({ ...config, [`${who}Signature`]: png } as Config);
      setSigChanges(c => ({ ...c, [who]: png }));
      setMessage("");
    } catch (err) { setOk(false); setMessage(err instanceof Error ? err.message : "Could not read that image"); }
  }
  function remove(who: Who) {
    if (!config) return;
    setConfig({ ...config, [`${who}Signature`]: null } as Config);
    setSigChanges(c => ({ ...c, [who]: null }));
  }

  async function save(e: FormEvent) {
    e.preventDefault(); if (!config) return;
    setBusy(true); setMessage("");
    const body: Record<string, unknown> = { presidentName: config.presidentName, treasurerName: config.treasurerName };
    if (sigChanges.president !== undefined) body.presidentSignature = sigChanges.president;
    if (sigChanges.treasurer !== undefined) body.treasurerSignature = sigChanges.treasurer;
    const r = await fetch("/api/admin/receipt-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    setOk(r.ok); setMessage(r.ok ? "Receipt signatories saved. New receipts will show them." : d.error || "Save failed");
    if (r.ok) { setConfig(d.config); setSigChanges({}); }
    setBusy(false);
  }

  if (!config) return <p className="text-portal-muted">{message || "Loading…"}</p>;

  const panel = (who: Who, title: string) => {
    const name = who === "president" ? config.presidentName : config.treasurerName;
    const sig = who === "president" ? config.presidentSignature : config.treasurerSignature;
    return (
      <div className="space-y-3 rounded-lg border border-black/10 bg-white/50 p-4">
        <h3 className="font-semibold text-portal-text">{title}</h3>
        <label className="block text-sm text-portal-muted">Full name
          <input value={name} maxLength={100} onChange={e => setConfig({ ...config, [`${who}Name`]: e.target.value } as Config)} className="portal-input mt-1" />
        </label>
        <div className="text-sm text-portal-muted">Signature (image)
          <div className="mt-1 flex h-20 items-center justify-center rounded-lg border border-dashed border-black/20 bg-white">
            {sig ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={sig} alt={`${title} signature`} className="max-h-16 max-w-full object-contain" /> : <span className="text-xs">No signature uploaded</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="portal-btn-ghost cursor-pointer">{sig ? "Replace image" : "Upload image"}<input type="file" accept="image/png,image/jpeg" className="hidden" onChange={e => pick(who, e)} /></label>
            {sig && <button type="button" className="portal-btn-ghost" onClick={() => remove(who)}>Remove</button>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="portal-card-glass max-w-2xl p-6">
        <h2 className="mb-1 text-xl font-semibold text-portal-text">Receipt signatories</h2>
        <p className="mb-5 text-sm text-portal-muted">The President and Treasurer printed on every PDF receipt. Upload each signature as a PNG or JPG - a clear signature on a white or transparent background works best.</p>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">{panel("president", "President")}{panel("treasurer", "Treasurer")}</div>
          {message && <p role="status" className={`text-sm ${ok ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
          <button disabled={busy} className="portal-btn-primary">{busy ? "Saving…" : "Save signatories"}</button>
        </form>
      </section>
      <PortalQr />
    </div>
  );
}
