import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";
  return NextResponse.json({
    publicKey,
    configured: Boolean(publicKey),
  });
}
