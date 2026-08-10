import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getRecallById, markSmsSent } from "@/lib/db";
import { sendRecallSms } from "@/lib/sms";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "number" ? body.id : Number(body?.id);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { error: "Provide a valid recall record id." },
      { status: 400 },
    );
  }

  const recall = await getRecallById(id);
  if (!recall) {
    return NextResponse.json({ error: "Recall record not found." }, { status: 404 });
  }

  const result = await sendRecallSms(recall);
  if (result.ok) {
    await markSmsSent(id);
  }
  return NextResponse.json(
    { ...result, sms_sent: result.ok },
    { status: result.ok ? 200 : 400 },
  );
}
