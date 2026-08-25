"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "Missing reset token. Request a new link from the login page.",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      setError("Missing reset token. Request a new link from the login page.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not reset password.");
        return;
      }
      setMessage(data.message || "Password updated.");
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-up mx-auto w-full max-w-md">
      <p className="brand-mark text-xs font-bold text-[var(--honda-red)]">
        Account
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl tracking-wide">
        Choose a new password
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        Enter a new password for your account. The link from your email can only
        be used once.
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 rounded-2xl p-6">
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            disabled={!token}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-semibold"
            htmlFor="confirm_password"
          >
            Confirm password
          </label>
          <input
            id="confirm_password"
            type="password"
            className="input"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
            disabled={!token}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[var(--ok)]">
            {message}
          </p>
        )}

        <button
          className="btn btn-primary w-full"
          disabled={loading || !token}
        >
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        <Link
          href="/forgot-password"
          className="font-semibold text-[var(--ink)] underline"
        >
          Request a new reset link
        </Link>
        {" · "}
        <Link href="/login" className="font-semibold text-[var(--ink)] underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
