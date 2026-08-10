import { NextRequest, NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/mail";
import { createUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { user, token } = await createUser({
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      first_name: String(body.first_name ?? ""),
      surname: String(body.surname ?? ""),
      telephone: String(body.telephone ?? ""),
      city: String(body.city ?? ""),
    });

    const mail = await sendVerificationEmail({
      to: user.email,
      firstName: user.first_name,
      token,
    });

    return NextResponse.json({
      ok: true,
      user: {
        email: user.email,
        first_name: user.first_name,
        surname: user.surname,
      },
      message: mail.message,
      // Only returned when SMTP is not configured (local/dev convenience).
      verificationUrl: mail.previewUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
