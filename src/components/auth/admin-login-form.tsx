"use client";

import { useState } from "react";
import { getSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type Props = { portal: "SUPER_ADMIN" | "ADMIN" };

export function AdminLoginForm({ portal }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setLoading(false);
      // NextAuth reports a failed authorize() returning null as the generic
      // code "CredentialsSignin" - show our own generic message for that.
      // A custom Error thrown from authorize() (e.g. the rate-limit message)
      // comes through as its own text and is shown as-is.
      setError(result.error === "CredentialsSignin" ? "Invalid email or password" : result.error);
      return;
    }

    // Role gate for the two login pages. This is only a convenience so each
    // page signs in the right kind of account; real authorization is still
    // enforced on the server for every protected page and API route.
    const session = await getSession();
    const role = (session?.user as { role?: string } | undefined)?.role;
    const isSuper = role === "SUPER_ADMIN";
    if ((portal === "SUPER_ADMIN" && !isSuper) || (portal === "ADMIN" && isSuper)) {
      await signOut({ redirect: false });
      setLoading(false);
      setError(
        portal === "SUPER_ADMIN"
          ? "This is not a Super Admin account. Use the Admin sign-in page."
          : "This is a Super Admin account. Use the Super Admin sign-in page."
      );
      return;
    }

    setSuccess(true);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="portal-shell flex min-h-screen items-center justify-center px-4">
      <div className="portal-content w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <div className="portal-crest">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/school-crest.png" alt="University of Mines and Technology crest" />
          </div>
          <h1 className="text-2xl font-bold text-portal-text">UMaT SRC Payments</h1>
          <p className="portal-text-on-photo text-base font-medium">{portal === "SUPER_ADMIN" ? "Super Admin Sign In" : "Admin Sign In"}</p>
        </div>

        <form onSubmit={handleSubmit} className="portal-card space-y-4 p-8 text-left">
          <p className="text-sm text-portal-muted">Welcome back! Please sign in to continue</p>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 border border-red-200">{error}</p>
          )}

          {success && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 border border-emerald-200">
              Login successful. Redirecting…
            </p>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-portal-text">Email</label>
            <input
              type="email"
              required
              className="portal-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-portal-text">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="portal-input pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-portal-muted hover:text-portal-text"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="text-right">
              <a href="/forgot-password" className="text-sm text-portal-muted hover:text-portal-text hover:underline">
                Forgot password?
              </a>
            </div>
          </div>

          <button type="submit" disabled={loading} className="portal-btn-primary flex w-full items-center justify-center gap-2">
            {loading && <Spinner />}
            {success ? "Signed in" : loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
    }
