import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listRecallsByRecallNo, markSmsSentMany } from "@/lib/db";
import { sendRecallSms } from "@/lib/sms";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const recallNo =
    typeof body?.recallNo === "string" ? body.recallNo.trim() : "";

  if (!recallNo || recallNo === "all") {
    return NextResponse.json(
      { error: "Select a specific Recall No. tab before sending bulk SMS." },
      { status: 400 },
    );
  }

  const rows = await listRecallsByRecallNo(recallNo);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No records found for this Recall No." },
      { status: 404 },
    );
  }

  let sent = 0;
  let failed = 0;
  let skippedNoPhone = 0;
  const failures: { id: number; message: string }[] = [];
  const sentIds: number[] = [];

  for (const row of rows) {
    if (!row.telephone.trim()) {
      skippedNoPhone += 1;
      continue;
    }

    const result = await sendRecallSms(row);
    if (result.ok) {
      sent += 1;
      sentIds.push(row.id);
    } else {
      failed += 1;
      failures.push({ id: row.id, message: result.message });
    }
  }

  if (sentIds.length > 0) {
    await markSmsSentMany(sentIds);
  }

  return NextResponse.json({
    ok: sent > 0 && failed === 0,
    recallNo,
    total: rows.length,
    sent,
    failed,
    skippedNoPhone,
    failures: failures.slice(0, 10),
    message: `Bulk SMS for ${recallNo}: sent ${sent}, failed ${failed}, skipped ${skippedNoPhone} (no phone).`,
  });
}
