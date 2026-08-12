import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { updateUserProfile } from "@/lib/users";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const updated = await updateUserProfile(user.id, {
      first_name: String(body.first_name ?? ""),
      surname: String(body.surname ?? ""),
      telephone: String(body.telephone ?? ""),
      city: String(body.city ?? ""),
    });
    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update profile.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
