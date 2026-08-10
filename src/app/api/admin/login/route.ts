import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
