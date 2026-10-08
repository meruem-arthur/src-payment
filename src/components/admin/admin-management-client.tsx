"use client";
import { FormEvent, useEffect, useState } from "react";

type AdminUser = { id: string; name: string; email: string; status: string; createdAt: string };
export function AdminManagementClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/admin-users", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setUsers(data.users);
    else setMessage(data.error || "Could not load admins.");
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin-users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || "Could not create admin."); return; }
      setMessage(`Admin account created for ${data.user.email}.`); setName(""); setEmail(""); setPassword(""); await load();
    } catch { setMessage("Network error. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
    <form onSubmit={submit} className="admin-card space-y-4 p-5">
      <h2 className="text-lg font-bold text-admin-text">Create SRC Admin</h2>
      <label className="block text-sm text-admin-muted">Full name<input className="admin-input mt-1 w-full" required minLength={2} value={name} onChange={e=>setName(e.target.value)} /></label>
      <label className="block text-sm text-admin-muted">Email address<input className="admin-input mt-1 w-full" type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
      <label className="block text-sm text-admin-muted">Temporary password<input className="admin-input mt-1 w-full" type="password" required minLength={12} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} /><span className="mt-1 block text-xs">Use at least 12 characters. Share it securely and have the admin change it after signing in.</span></label>
      <button className="admin-btn-primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create Admin"}</button>
      {message && <p role="status" className="text-sm text-admin-muted">{message}</p>}
    </form>
    <section className="admin-card p-5">
      <h2 className="mb-4 text-lg font-bold text-admin-text">Existing SRC Admins</h2>
      {users.length === 0 ? <p className="text-sm text-admin-muted">No SRC admins found yet.</p> : <div className="space-y-3">{users.map(user=><div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div><p className="font-medium text-admin-text">{user.name}</p><p className="text-sm text-admin-muted">{user.email}</p></div><span className="rounded-full bg-white/10 px-2 py-1 text-xs text-admin-muted">{user.status}</span></div>)}</div>}
    </section>
  </div>;
}
