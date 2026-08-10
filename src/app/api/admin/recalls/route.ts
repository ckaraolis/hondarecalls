import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
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
