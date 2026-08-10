"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      router.push("/account");
      router.refresh();
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
        Log in
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        Use your email and password after you have verified your email address.
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
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        New here?{" "}
        <Link
          href="/register"
          className="font-semibold text-[var(--ink)] underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
