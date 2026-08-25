import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={<p className="text-[var(--muted)]">Loading reset form…</p>}
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
