import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth";
import {
  DEFAULT_SMS_TEMPLATE,
  SMS_MAX_LENGTH,
  getSmsTemplate,
  setSmsTemplate,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireAdminPermission("full");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized." : "Forbidden." },
      { status: access.status },
    );
  }

  const template = await getSmsTemplate();
  return NextResponse.json({
    template,
    maxLength: SMS_MAX_LENGTH,
    placeholders: [
      "{name}",
      "{surname}",
      "{owner}",
      "{reg}",
      "{vin}",
      "{model}",
      "{recall_no}",
      "{description}",
      "{part_number}",
      "{city}",
      "{engine}",
    ],
    defaultTemplate: DEFAULT_SMS_TEMPLATE,
  });
}

export async function PUT(request: NextRequest) {
  const access = await requireAdminPermission("full");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized." : "Forbidden." },
      { status: access.status },
    );
  }

  const body = await request.json().catch(() => null);
  const template = typeof body?.template === "string" ? body.template : "";

  try {
    const saved = await setSmsTemplate(template);
    return NextResponse.json({
      ok: true,
      template: saved,
      maxLength: SMS_MAX_LENGTH,
      message: "SMS template saved.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save SMS template.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
