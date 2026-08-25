import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  try {
    const result = await resetPasswordWithToken(token, password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not reset password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
