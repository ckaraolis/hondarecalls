"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Validating your email…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/auth/verify?token=${encodeURIComponent(token)}`,
        );
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setStatus("error");
          setMessage(data.error || "Verification failed.");
          return;
        }
        setStatus("ok");
        setMessage(data.message || "Email verified. You can log in now.");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Could not verify email.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="fade-up mx-auto w-full max-w-md">
      <p className="brand-mark text-xs font-bold text-[var(--honda-red)]">
        Account
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl tracking-wide">
        Email validation
      </h1>

      <div
        className={`panel mt-8 rounded-2xl p-6 text-sm ${
          status === "ok"
            ? "border border-emerald-200 bg-emerald-50 text-[var(--ok)]"
            : status === "error"
              ? "border border-red-200 bg-red-50 text-red-700"
              : "text-[var(--muted)]"
        }`}
      >
        <p>{message}</p>
        {status === "ok" && (
          <button
            type="button"
            className="btn btn-primary mt-4 w-full"
            onClick={() => router.push("/login")}
          >
            Continue to login
          </button>
        )}
        {status === "error" && (
          <Link href="/register" className="btn btn-secondary mt-4 inline-flex">
            Back to create account
          </Link>
        )}
      </div>
    </div>
  );
}
