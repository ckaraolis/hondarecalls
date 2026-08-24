import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSmsCredits } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
