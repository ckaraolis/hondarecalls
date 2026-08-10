import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { deleteRecallCampaign } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const recallNo =
    typeof body?.recallNo === "string" ? body.recallNo.trim() : "";

  if (!recallNo || recallNo === "all") {
    return NextResponse.json(
      { error: "Select a specific Recall No. campaign to delete." },
      { status: 400 },
    );
  }

  const { deleted } = await deleteRecallCampaign(recallNo);
  if (deleted === 0) {
    return NextResponse.json(
      { error: "No records found for this campaign." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    deleted,
    message: `Deleted campaign "${recallNo}" (${deleted} record${deleted === 1 ? "" : "s"}).`,
  });
}
