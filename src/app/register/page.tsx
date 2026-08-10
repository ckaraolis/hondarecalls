"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    surname: "",
    telephone: "",
    city: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setVerificationUrl(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not create account.");
        return;
      }
      setSuccess(data.message || "Account created. Please verify your email.");
      if (data.verificationUrl) {
        setVerificationUrl(data.verificationUrl);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-up mx-auto w-full max-w-lg">
      <p className="brand-mark text-xs font-bold text-[var(--honda-red)]">
        Account
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl tracking-wide">
        Create account
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        Register with your email to get notified when a new recall is uploaded
        for your vehicle.
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 rounded-2xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="first_name">
              Name
            </label>
            <input
              id="first_name"
              className="input"
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="surname">
              Surname
            </label>
            <input
              id="surname"
              className="input"
              value={form.surname}
              onChange={(e) => update("surname", e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="email">
            Email (username)
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
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
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            minLength={6}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="telephone">
            Telephone number
          </label>
          <input
            id="telephone"
            className="input"
            value={form.telephone}
            onChange={(e) => update("telephone", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="city">
            City
          </label>
          <input
            id="city"
            className="input"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[var(--ok)]">
            <p>{success}</p>
            {verificationUrl && (
              <p className="mt-2 break-all">
                Dev verification link:{" "}
                <Link href={verificationUrl} className="font-semibold underline">
                  Verify email
                </Link>
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              onClick={() => router.push("/login")}
            >
              Go to login
            </button>
          </div>
        )}

        {!success && (
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        )}
      </form>

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--ink)] underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
