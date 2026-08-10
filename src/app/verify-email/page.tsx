import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={<p className="text-[var(--muted)]">Validating your email…</p>}
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
