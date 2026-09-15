import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth";
import {
  SMS_MAX_LENGTH,
  createCustomSmsTemplate,
  deleteCustomSmsTemplate,
  listCustomSmsTemplates,
  updateCustomSmsTemplate,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireAdminPermission("custom-sms");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized." : "Forbidden." },
      { status: access.status },
    );
  }

  const templates = await listCustomSmsTemplates();
  return NextResponse.json({ templates, maxLength: SMS_MAX_LENGTH });
}

export async function POST(request: NextRequest) {
  const access = await requireAdminPermission("custom-sms");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized." : "Forbidden." },
      { status: access.status },
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const message = typeof body?.body === "string" ? body.body : "";

  try {
    const template = await createCustomSmsTemplate({ name, body: message });
    return NextResponse.json({
      ok: true,
      template,
      message: "Template saved.",
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Could not save template.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireAdminPermission("custom-sms");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized." : "Forbidden." },
      { status: access.status },
    );
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name : undefined;
  const message = typeof body?.body === "string" ? body.body : undefined;

  try {
    const template = await updateCustomSmsTemplate({
      id,
      name,
      body: message,
    });
    return NextResponse.json({
      ok: true,
      template,
      message: "Template updated.",
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Could not update template.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdminPermission("custom-sms");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized." : "Forbidden." },
      { status: access.status },
    );
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";

  try {
    const deleted = await deleteCustomSmsTemplate(id);
    if (!deleted) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, message: "Template deleted." });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Could not delete template.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
