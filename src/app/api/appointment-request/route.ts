import { NextRequest, NextResponse } from "next/server";
import { getRecallById } from "@/lib/db";
import { sendAppointmentRequestEmail } from "@/lib/mail";
import { normalizeIdentity } from "@/lib/supabase";

export const runtime = "nodejs";

function requiredString(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  return text;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const email = requiredString(body.email, "Email");
    const name = requiredString(body.name, "Name");
    const telephone = requiredString(body.telephone, "Telephone");
    const city = requiredString(body.city, "City");
    const regNo = requiredString(body.reg_no, "Car Number");
    const odometerKm = requiredString(body.odometer_km, "Odometer KM");
    const recallId = Number(body.recall_id);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }
    if (!/^\d+$/.test(odometerKm)) {
      return NextResponse.json(
        { error: "Odometer KM must be a whole number." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(recallId) || recallId <= 0) {
      return NextResponse.json({ error: "Invalid recall." }, { status: 400 });
    }

    const recall = await getRecallById(recallId);
    if (!recall || recall.done) {
      return NextResponse.json(
        { error: "This recall is not available for an appointment request." },
        { status: 400 },
      );
    }

    const carNorm = normalizeIdentity(regNo);
    const regNorm = normalizeIdentity(recall.reg_no);
    const vinNorm = normalizeIdentity(recall.vin_number);
    if (!carNorm || (carNorm !== regNorm && carNorm !== vinNorm)) {
      return NextResponse.json(
        { error: "Car Number does not match this recall." },
        { status: 400 },
      );
    }

    const result = await sendAppointmentRequestEmail({
      customerEmail: email,
      customerName: name,
      telephone,
      city,
      regNo: recall.reg_no || regNo,
      recallNo: recall.recall_no,
      description: recall.description,
      odometerKm,
    });

    return NextResponse.json({
      ok: true,
      message: result.message,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not send appointment request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
