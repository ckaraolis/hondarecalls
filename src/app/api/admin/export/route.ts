import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth";
import { listRecallsByRecallNo } from "@/lib/db";
import { buildRecallsExcelBuffer } from "@/lib/excel";

export const runtime = "nodejs";

function safeFilePart(value: string) {
  const cleaned = value.trim().replace(/[^\w.-]+/g, "_");
  return cleaned || "campaign";
}

export async function GET(request: NextRequest) {
  const access = await requireAdminPermission("full");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized." : "Forbidden." },
      { status: access.status },
    );
  }

  const recallNo = (request.nextUrl.searchParams.get("recallNo") ?? "").trim();
  if (!recallNo) {
    return NextResponse.json(
      { error: "Pick a Recall No. campaign (or All) to export." },
      { status: 400 },
    );
  }

  try {
    const rows = await listRecallsByRecallNo(
      recallNo === "all" ? "all" : recallNo,
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No records found to export for this campaign." },
        { status: 404 },
      );
    }

    const buffer = buildRecallsExcelBuffer(rows);
    const label = recallNo === "all" ? "all" : safeFilePart(recallNo);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `honda-recall-${label}-${stamp}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export Excel file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
