import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { upsertRecalls } from "@/lib/db";
import { parseRecallsExcel } from "@/lib/excel";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Please upload an Excel file." },
      { status: 400 },
    );
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
    return NextResponse.json(
      { error: "Only .xlsx, .xls, or .csv files are supported." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseRecallsExcel(buffer);
    const { added, updated, skipped, total, addedRows } = await upsertRecalls(rows);

    let notifySummary = "";
    if (addedRows.length > 0) {
      const { notifyUsersOfNewRecalls } = await import("@/lib/notify");
      const notifyResult = await notifyUsersOfNewRecalls(addedRows);
      if (notifyResult.notificationsCreated > 0) {
        notifySummary = ` Notified ${notifyResult.notifiedUsers} account user${
          notifyResult.notifiedUsers === 1 ? "" : "s"
        } (${notifyResult.notificationsCreated} alert${
          notifyResult.notificationsCreated === 1 ? "" : "s"
        }).`;
      }
    }

    const parts: string[] = [];
    if (added > 0) {
      parts.push(`Added ${added} new record${added === 1 ? "" : "s"}`);
    }
    if (updated > 0) {
      parts.push(
        `updated ${updated} existing record${updated === 1 ? "" : "s"} (including Done / contact fields)`,
      );
    }
    if (skipped > 0) {
      parts.push(`skipped ${skipped} empty row${skipped === 1 ? "" : "s"}`);
    }
    if (parts.length === 0) {
      parts.push("No changes");
    }

    return NextResponse.json({
      ok: true,
      added,
      updated,
      skipped,
      total,
      sample: rows[0],
      message: `${parts.join(". ")}. Database now has ${total} record${total === 1 ? "" : "s"}.${notifySummary}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import Excel file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
