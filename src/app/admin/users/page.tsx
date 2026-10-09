"use client";
import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AdminShell } from "@/components/admin/admin-shell";

type AdminUser = { id: string; name: string; email: string; role: string; status: string; createdAt: string };

// How long "Saved" shows before an edit panel closes by itself.
const EDIT_AUTO_CLOSE_MS = 1200;

function UserRow({ user, isSelf, onSaved }: { user: AdminUser; isSelf: boolean; onSaved: (u: AdminUser) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [status, setStatus] = useState(user.status);
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function open() {
    setName(user.name); setEmail(user.email); setStatus(user.status);
    setPassword(""); setCurrentPassword(""); setError(""); setSaved(false);
    setEditing(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setSaved(false);
    try {
      // Only send what changed. A blank password means "keep the current one".
      const body: Record<string, string> = {};
      if (name.trim() !== user.name) body.name = name.trim();
      if (email.trim().toLowerCase() !== user.email) body.email = email.trim();
      if (status !== user.status) body.status = status;
      if (password) body.password = password;
      if (isSelf && (body.email || body.password)) body.currentPassword = currentPassword;
      if (Object.keys(body).length === 0) { setEditing(false); return; }

      const res = await fetch(`/api/admin-users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not save changes."); return; }
      onSaved(data.user);
      setPassword(""); setCurrentPassword(""); setSaved(true);
      setTimeout(() => { setEditing(false); setSaved(false); }, EDIT_AUTO_CLOSE_MS);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const needsCurrent = isSelf && (email.trim().toLowerCase() !== user.email || password.length > 0);

  return (
    <div className="border-b border-black/10 p-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-portal-text">{user.name}{isSelf && <span className="ml-2 text-xs font-medium text-portal-accentDark">(you)</span>}</p>
          <p className="truncate text-sm text-portal-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-black/5 px-2 py-1 text-xs text-portal-text">{user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
          <span className={`text-xs font-semibold ${user.status === "ACTIVE" ? "text-emerald-700" : "text-red-600"}`}>{user.status}</span>
          {!editing && <button type="button" onClick={open} className="portal-btn-ghost !px-3 !py-1.5 text-sm">Edit</button>}
        </div>
      </div>

      {editing && (
        <form onSubmit={save} className="mt-4 grid gap-3 border-t border-black/10 pt-4 sm:grid-cols-2">
          <label className="text-sm text-portal-muted">Full name
            <input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="portal-input mt-1" />
          </label>
          <label className="text-sm text-portal-muted">Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="portal-input mt-1" />
          </label>
          <label className="text-sm text-portal-muted">Status
            <select value={status} disabled={isSelf} onChange={(e) => setStatus(e.target.value)} className="portal-input mt-1">
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended (cannot sign in)</option>
            </select>
            {isSelf && <span className="mt-1 block text-xs">You can&apos;t suspend your own account.</span>}
          </label>
          <label className="text-sm text-portal-muted">New password (optional)
            <input type="password" minLength={12} autoComplete="new-password" placeholder="Leave blank to keep the current one" value={password} onChange={(e) => setPassword(e.target.value)} className="portal-input mt-1" />
            <span className="mt-1 block text-xs">At least 12 characters.</span>
          </label>
          {needsCurrent && (
            <label className="text-sm text-portal-muted sm:col-span-2">Your current password (needed to change your own email or password)
              <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="portal-input mt-1" />
            </label>
          )}
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">{error}</p>}
          {saved && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 sm:col-span-2">Saved.</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="portal-btn-primary">{busy ? "Saving…" : "Save changes"}</button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)} className="portal-btn-ghost">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const { data: session, status, update } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ADMIN");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const me = session?.user as any;

  async function load() {
    const r = await fetch("/api/admin-users");
    const d = await r.json();
    if (r.ok) setUsers(d.users || []);
    else setMessage(d.error || "Unable to load accounts");
  }
  useEffect(() => { if (status === "authenticated" && me?.role === "SUPER_ADMIN") load(); }, [status, session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage("");
    const r = await fetch("/api/admin-users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, role }) });
    const d = await r.json();
    if (!r.ok) setMessage(d.error || "Unable to create account");
    else { setMessage("Administrator account created."); setName(""); setEmail(""); setPassword(""); setRole("ADMIN"); load(); }
    setBusy(false);
  }

  async function handleSaved(updated: AdminUser) {
    setUsers((list) => list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    // If the Super Admin edited their own details, refresh the session so the new name/email show everywhere.
    if (updated.id === me?.id) await update();
  }

  if (status === "loading") return <main className="portal-shell flex min-h-screen items-center justify-center"><p className="portal-content text-portal-text">Loading…</p></main>;
  if (me?.role !== "SUPER_ADMIN") {
    return (
      <main className="portal-shell flex min-h-screen items-center justify-center px-4">
        <div className="portal-content portal-card-glass max-w-md p-8 text-center text-portal-text">
          Super Admin access required. <a href="/admin/login" className="font-semibold text-portal-accentDark underline">Sign in</a>
        </div>
      </main>
    );
  }

  return (
    <AdminShell
      eyebrow="System access"
      title="Administrator accounts"
      subtitle="Create and edit administrators, including your own details."
      actions={<a href="/admin" className="portal-btn-ghost">Back to dashboard</a>}
    >
      <section className="portal-card-glass p-6">
        <h2 className="mb-4 text-xl font-semibold text-portal-text">Create account</h2>
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-portal-muted">Full name<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="portal-input mt-1" /></label>
          <label className="text-sm text-portal-muted">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="portal-input mt-1" /></label>
          <label className="text-sm text-portal-muted">Temporary password (12+ characters)<input required minLength={12} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="portal-input mt-1" /></label>
          <label className="text-sm text-portal-muted">Role
            <select value={role} onChange={(e) => setRole(e.target.value)} className="portal-input mt-1"><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super Admin</option></select>
          </label>
          <div className="sm:col-span-2">
            <button disabled={busy} className="portal-btn-primary">{busy ? "Creating…" : "Create account"}</button>
            {message && <p role="status" className="mt-3 text-sm text-portal-text">{message}</p>}
          </div>
        </form>
      </section>

      <section className="portal-card-glass">
        <h2 className="border-b border-black/10 p-4 text-xl font-semibold text-portal-text">All administrators</h2>
        {users.length === 0 ? <p className="p-6 text-sm text-portal-muted">No accounts found.</p> : users.map((u) => <UserRow key={u.id} user={u} isSelf={u.id === me?.id} onSaved={handleSaved} />)}
      </section>
    </AdminShell>
  );
}
