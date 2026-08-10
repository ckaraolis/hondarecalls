import { NextRequest, NextResponse } from "next/server";
import { createUserSession } from "@/lib/user-auth";
import { authenticateUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const result = await authenticateUser(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  await createUserSession(result.user.id);
  return NextResponse.json({ ok: true, user: result.user });
}
