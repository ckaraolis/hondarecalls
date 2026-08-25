"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setPreviewUrl(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not send reset email.");
        return;
      }
      setMessage(
        data.message ||
          "If an account exists for that email, a password reset link has been sent.",
      );
      if (typeof data.previewUrl === "string" && data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
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
        Reset password
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        Enter your account email and we will send a reset link.
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 rounded-2xl p-6">
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[var(--ok)]">
            <p>{message}</p>
            {previewUrl && (
              <p className="mt-2 break-all">
                Dev reset link:{" "}
                <Link
                  href={previewUrl}
                  className="font-semibold underline text-[var(--ink)]"
                >
                  {previewUrl}
                </Link>
              </p>
            )}
          </div>
        )}

        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-semibold text-[var(--ink)] underline"
        >
          Back to login
        </Link>
      </p>
    </div>
  );
}
