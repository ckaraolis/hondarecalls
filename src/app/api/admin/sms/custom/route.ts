import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth";
import { parsePhoneList, sendCustomSmsToMany, SMS_MAX_LENGTH } from "@/lib/sms";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = await requireAdminPermission("custom-sms");
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized." : "Forbidden." },
      { status: access.status },
    );
  }

  const body = await request.json().catch(() => null);
  const message =
    typeof body?.message === "string" ? body.message.trim() : "";
  const phonesRaw =
    typeof body?.phones === "string"
      ? body.phones
      : Array.isArray(body?.phones)
        ? (body.phones as unknown[])
            .map((value) => String(value ?? "").trim())
            .filter(Boolean)
            .join("\n")
        : "";

  if (!message) {
    return NextResponse.json(
      { error: "SMS message is required." },
      { status: 400 },
    );
  }
  if (message.length > SMS_MAX_LENGTH) {
    return NextResponse.json(
      { error: `SMS message must be ${SMS_MAX_LENGTH} characters or less.` },
      { status: 400 },
    );
  }

  const phones = parsePhoneList(phonesRaw);
  if (phones.length === 0) {
    return NextResponse.json(
      { error: "Enter at least one mobile number." },
      { status: 400 },
    );
  }

  const result = await sendCustomSmsToMany(phones, message);
  return NextResponse.json(result, {
    status: result.sent > 0 ? 200 : 400,
  });
}
