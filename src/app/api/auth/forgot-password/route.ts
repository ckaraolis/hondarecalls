import { NextRequest, NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/mail";
import { findUserByEmail, requestPasswordReset } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";

  try {
    const result = await requestPasswordReset(email);

    if (result.token) {
      const user = await findUserByEmail(email);
      if (user) {
        const mail = await sendPasswordResetEmail({
          to: user.email,
          firstName: user.first_name,
          token: result.token,
        });
        return NextResponse.json({
          ok: true,
          message: result.message,
          // Only returned when SMTP is unavailable (local/dev convenience).
          previewUrl: mail.previewUrl ?? null,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      previewUrl: null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start password reset.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
