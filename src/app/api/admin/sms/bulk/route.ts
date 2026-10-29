import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth";
import {
  listRecallsByIds,
  listRecallsByRecallNo,
  markSmsSentMany,
  type Recall,
} from "@/lib/db";
import { sendRecallSms } from "@/lib/sms";

export const runtime = "nodejs";

async function sendToRows(
  rows: Recall[],
  label: string,
  options?: { unsentOnly?: boolean },
) {
  let sent = 0;
  let failed = 0;
  let skippedNoPhone = 0;
  let skippedAlreadySent = 0;
  const failures: { id: number; message: string }[] = [];
  const sentIds: number[] = [];

  for (const row of rows) {
    if (options?.unsentOnly && row.sms_sent) {
      skippedAlreadySent += 1;
      continue;
    }
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

  const alreadyPart = options?.unsentOnly
    ? `, already sent ${skippedAlreadySent}`
    : "";

  return {
    ok: sent > 0 && failed === 0,
    total: rows.length,
    sent,
    failed,
    skippedNoPhone,
    skippedAlreadySent,
    failures: failures.slice(0, 10),
    message: `Bulk SMS${label}: sent ${sent}, failed ${failed}, skipped ${skippedNoPhone} (no phone)${alreadyPart}.`,
  };
}

export async function POST(request: NextRequest) {
  const access = await requireAdminPermission("full");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized." : "Forbidden." },
      { status: access.status },
    );
  }

  const body = await request.json().catch(() => null);
  const rawIds: unknown[] | null = Array.isArray(body?.ids)
    ? (body.ids as unknown[])
    : null;
  const recallNo =
    typeof body?.recallNo === "string" ? body.recallNo.trim() : "";
  const unsentOnly = body?.unsentOnly === true;

  if (rawIds) {
    const ids: number[] = [];
    for (const value of rawIds) {
      const id = Number(value);
      if (Number.isFinite(id) && id > 0 && !ids.includes(id)) {
        ids.push(id);
      }
    }
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

    const target = unsentOnly ? rows.filter((row) => !row.sms_sent) : rows;
    if (target.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          sent: 0,
          failed: 0,
          skippedNoPhone: 0,
          skippedAlreadySent: rows.length,
          message: "No selected entries still need an SMS.",
        },
        { status: 200 },
      );
    }

    const result = await sendToRows(
      target,
      ` for ${target.length} selected`,
      { unsentOnly },
    );
    return NextResponse.json({ ...result, ids });
  }

  if (!recallNo) {
    return NextResponse.json(
      {
        error:
          "Select entries with the checkboxes, or pick a Recall No. / All before sending bulk SMS.",
      },
      { status: 400 },
    );
  }

  if (!unsentOnly && recallNo === "all") {
    return NextResponse.json(
      {
        error:
          "Select a specific Recall No. tab before sending SMS to all owners, or use SMS not sent yet.",
      },
      { status: 400 },
    );
  }

  const rows = await listRecallsByRecallNo(
    recallNo === "all" ? "all" : recallNo,
  );
  const target = unsentOnly ? rows.filter((row) => !row.sms_sent) : rows;

  if (target.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        sent: 0,
        failed: 0,
        skippedNoPhone: 0,
        skippedAlreadySent: rows.length,
        recallNo,
        message: unsentOnly
          ? "No entries still need an SMS in this view."
          : "No records found for this Recall No.",
      },
      { status: unsentOnly ? 200 : 404 },
    );
  }

  const scopeLabel =
    recallNo === "all"
      ? " for all unsent entries"
      : unsentOnly
        ? ` for unsent on ${recallNo}`
        : ` for ${recallNo}`;
  const result = await sendToRows(target, scopeLabel, { unsentOnly });
  return NextResponse.json({ ...result, recallNo });
}
