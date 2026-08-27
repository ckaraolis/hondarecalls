import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  deleteRecallsByIds,
  getRecallCount,
  listRecallGroups,
  listRecallsByRecallNo,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const recallNo = request.nextUrl.searchParams.get("recallNo");

  try {
    const [count, groups, rows] = await Promise.all([
      getRecallCount(),
      listRecallGroups(),
      listRecallsByRecallNo(recallNo),
    ]);

    return NextResponse.json({ count, groups, rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load recalls.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rawIds = Array.isArray(body?.ids) ? (body.ids as unknown[]) : null;
  if (!rawIds) {
    return NextResponse.json(
      { error: "Select at least one entry to delete." },
      { status: 400 },
    );
  }

  const ids: number[] = [];
  for (const value of rawIds) {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0 && !ids.includes(id)) {
      ids.push(id);
    }
  }

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Select at least one entry to delete." },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteRecallsByIds(ids);
    return NextResponse.json({
      ok: true,
      deleted,
      message: `Deleted ${deleted} selected entr${deleted === 1 ? "y" : "ies"}.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not delete selected rows.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
