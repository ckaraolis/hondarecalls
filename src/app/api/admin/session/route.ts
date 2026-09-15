import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({
      authenticated: false,
      username: null,
      permissions: [],
    });
  }
  return NextResponse.json({
    authenticated: true,
    username: session.username,
    permissions: session.permissions,
  });
}
