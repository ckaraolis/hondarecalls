import { NextRequest, NextResponse } from "next/server";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
import { getCurrentUser } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.all === true) {
    const updated = await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true, updated });
  }

  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { error: "Provide id or all: true." },
      { status: 400 },
    );
  }

  await markNotificationRead(user.id, id);
  return NextResponse.json({ ok: true });
}
