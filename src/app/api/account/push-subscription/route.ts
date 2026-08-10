import { NextRequest, NextResponse } from "next/server";
import {
  deletePushSubscription,
  savePushSubscription,
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

  const endpoint = String(body.endpoint ?? "").trim();
  const p256dh = String(body.keys?.p256dh ?? body.p256dh ?? "").trim();
  const auth = String(body.keys?.auth ?? body.auth ?? "").trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint, p256dh, and auth are required." },
      { status: 400 },
    );
  }

  await savePushSubscription(user.id, { endpoint, p256dh, auth });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint = String(body?.endpoint ?? "").trim();
  if (!endpoint) {
    return NextResponse.json(
      { error: "endpoint is required." },
      { status: 400 },
    );
  }

  await deletePushSubscription(user.id, endpoint);
  return NextResponse.json({ ok: true });
}
