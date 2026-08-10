import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/users";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = await verifyEmailToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    message: "Email verified successfully. You can now log in.",
    user: {
      email: result.user.email,
      first_name: result.user.first_name,
    },
  });
}
