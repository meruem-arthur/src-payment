"use client";
import { useState } from "react";
import { PRODUCTS } from "@/lib/catalog";
const products = Object.entries(PRODUCTS).map(([id, p]) => ({ id, label: p.label, amount: p.amount }));
export default function Home() {
  const [items, setItems] = useState<string[]>([]); const [fullName, setFullName] = useState(""); const [referenceNumber, setReferenceNumber] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const total = products.filter(p => items.includes(p.id)).reduce((sum, p) => sum + p.amount, 0);
  async function pay() {
    setBusy(true); setError("");
    try { const res = await fetch("/api/payments/initiate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, referenceNumber, phone, email, items }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Unable to start payment"); window.location.assign(data.authorizationUrl); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to start payment"); setBusy(false); }
  }
  const field = "text-left text-sm text-portal-muted";
  return (
    <main className="portal-shell flex flex-col items-center px-4 py-12">
      <div className="portal-content w-full max-w-3xl space-y-8 text-center">
        <div className="space-y-3">
          <div className="portal-logos">
            <div className="portal-crest">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/school-crest.png" alt="University of Mines and Technology crest" />
            </div>
            <div className="portal-crest">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/src-logo.png" alt="SRC logo: Leadership, Liberty and Service" />
            </div>
          </div>
          <div>
            <p className="portal-heading-on-photo text-sm font-bold uppercase tracking-widest sm:text-base">University Of Mines And Technology</p>
            <p className="portal-heading-on-photo text-sm font-bold uppercase tracking-widest sm:text-base">Essikado Campus</p>
            <p className="mt-1 text-base font-semibold text-black sm:text-lg">Student Representative Council</p>
          </div>
        </div>

        <section className="portal-card space-y-6 p-4 text-left sm:p-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-portal-text sm:text-lg">Choose what you need</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {products.map(p => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-portal-border bg-portal-bg/60 p-3">
                  <input type="checkbox" className="h-4 w-4 accent-[#0f9b8e]" checked={items.includes(p.id)} onChange={e => setItems(old => e.target.checked ? [...old, p.id] : old.filter(id => id !== p.id))} />
                  <span className="flex-1 text-sm text-portal-text">{p.label}</span>
                  <strong className="text-sm text-portal-accent">GHS {p.amount.toLocaleString()}</strong>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-portal-text sm:text-lg">Your details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {([["Full name", fullName, setFullName], ["Reference number", referenceNumber, setReferenceNumber], ["Phone number", phone, setPhone], ["Email", email, setEmail]] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
                <label key={label} className={field}>{label}<input className="portal-input mt-1" type={label === "Email" ? "email" : "text"} inputMode={label === "Email" ? "email" : label === "Phone number" ? "tel" : undefined} autoComplete={label === "Email" ? "email" : undefined} value={value} onChange={e => setter(e.target.value)} /></label>
              ))}
            </div>
          </div>

          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex flex-col items-center justify-between gap-4 border-t border-portal-border pt-5 sm:flex-row">
            <div className="text-center sm:text-left">
              <p className="text-xs text-portal-muted">Total to pay</p>
              <p className="text-xl font-bold text-portal-accent sm:text-3xl">GHS {total.toLocaleString()}</p>
            </div>
            <button className="portal-btn-primary w-full sm:w-auto" disabled={busy || !items.length || !fullName.trim() || !referenceNumber.trim() || !phone.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())} onClick={pay}>
              {busy ? "Connecting to payment…" : "Proceed to payment"}
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}
