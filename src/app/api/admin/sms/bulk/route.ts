import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listRecallsByIds,
  listRecallsByRecallNo,
  markSmsSentMany,
  type Recall,
} from "@/lib/db";
import { sendRecallSms } from "@/lib/sms";

export const runtime = "nodejs";

async function sendToRows(rows: Recall[], label: string) {
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

  return {
    ok: sent > 0 && failed === 0,
    total: rows.length,
    sent,
    failed,
    skippedNoPhone,
    failures: failures.slice(0, 10),
    message: `Bulk SMS${label}: sent ${sent}, failed ${failed}, skipped ${skippedNoPhone} (no phone).`,
  };
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rawIds = Array.isArray(body?.ids) ? body.ids : null;
  const recallNo =
    typeof body?.recallNo === "string" ? body.recallNo.trim() : "";

  if (rawIds) {
    const ids = [
      ...new Set(
        rawIds
          .map((value: unknown) => Number(value))
          .filter((id: number) => Number.isFinite(id) && id > 0),
      ),
    ];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Select at least one entry to send SMS." },
        { status: 400 },
      );
    }

    const rows = await listRecallsByIds(ids);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No matching records found for the selection." },
        { status: 404 },
      );
    }

    const result = await sendToRows(rows, ` for ${ids.length} selected`);
    return NextResponse.json({ ...result, ids });
  }

  if (!recallNo || recallNo === "all") {
    return NextResponse.json(
      {
        error:
          "Select entries with the checkboxes, or pick a specific Recall No. tab before sending bulk SMS.",
      },
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

  const result = await sendToRows(rows, ` for ${recallNo}`);
  return NextResponse.json({ ...result, recallNo });
}
