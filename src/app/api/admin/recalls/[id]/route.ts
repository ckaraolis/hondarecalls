import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { deleteRecall, updateRecall } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

function readRecallBody(body: Record<string, unknown> | null) {
  if (!body || typeof body !== "object") return null;

  const str = (key: string) =>
    typeof body[key] === "string" ? body[key].trim() : "";

  const reg_no = str("reg_no");
  const vin_number = str("vin_number");
  const model = str("model");
  const recall_no = str("recall_no");
  const description = str("description");
  const part_number = str("part_number");
  const surname = str("surname");
  const first_name = str("first_name");
  const telephone = str("telephone");
  const city = str("city");
  const registration_date = str("registration_date");
  const engine_number = str("engine_number");

  const parseFlag = (key: string) => {
    const value = body[key];
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "number") return value ? 1 : 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "1" ||
        normalized === "yes" ||
        normalized === "true" ||
        normalized === "done"
        ? 1
        : 0;
    }
    return 0;
  };

  const done = parseFlag("done");
  const sms_sent = parseFlag("sms_sent");

  if (!reg_no && !vin_number) {
    return { error: "Reg. No or Vin Number is required." } as const;
  }

  return {
    data: {
      reg_no,
      vin_number,
      model,
      recall_no,
      description,
      part_number,
      surname,
      first_name,
      telephone,
      city,
      registration_date,
      engine_number,
      done,
      sms_sent,
    },
  } as const;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const id = parseId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: "Invalid record id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const parsed = readRecallBody(body);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const updated = await updateRecall(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, row: updated });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const id = parseId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: "Invalid record id." }, { status: 400 });
  }

  const deleted = await deleteRecall(id);
  if (!deleted) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
