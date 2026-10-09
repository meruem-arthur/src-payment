"use client";
import { FormEvent, Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/password-input";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false, callbackUrl: params.get("callbackUrl") || "/admin" });
    if (result?.error) {
      setError("Invalid email or password, or account is inactive.");
      setBusy(false);
    } else router.replace(result?.url || "/admin");
  }

  return (
    <main className="portal-shell flex min-h-screen items-center justify-center px-4">
      <div className="portal-content w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <div className="portal-logos">
            <div className="portal-crest">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/school-crest.png" alt="University of Mines and Technology crest" />
            </div>
            <div className="portal-crest">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/src-logo.png" alt="SRC logo" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-portal-text">UMaT SRC Payments</h1>
          <p className="portal-text-on-photo text-base font-medium">Administrator Sign In</p>
        </div>

        <form onSubmit={submit} className="portal-card-glass space-y-4 p-8 text-left">
          <label className="block text-sm font-medium text-portal-text">
            Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="portal-input mt-1" />
          </label>
          <label className="block text-sm font-medium text-portal-text">
            Password
            <PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="portal-btn-primary w-full">
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <a href="/" className="block text-center text-sm text-portal-muted hover:text-portal-text hover:underline">
            Return to student payments
          </a>
        </form>
      </div>
    </main>
  );
}

export default function AdminLogin() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
