import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth";
import { getSmsCredits } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdminPermission("custom-sms");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized." : "Forbidden." },
      { status: access.status },
    );
  }

  const result = await getSmsCredits();
  return NextResponse.json(
    {
      ok: result.ok,
      credits: result.credits,
      message: result.message,
    },
    { status: result.ok ? 200 : 400 },
  );
}
