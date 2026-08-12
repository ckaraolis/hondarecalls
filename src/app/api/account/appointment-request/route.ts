import { NextRequest, NextResponse } from "next/server";
import { getRecallById } from "@/lib/db";
import { sendAppointmentRequestEmail } from "@/lib/mail";
import { getCurrentUser } from "@/lib/user-auth";
import { getVehicleForUser } from "@/lib/vehicles";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const vehicleId = Number(body.vehicle_id);
  const recallId = Number(body.recall_id);
  const odometerKm = String(body.odometer_km ?? "").trim();

  if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
    return NextResponse.json({ error: "Invalid vehicle." }, { status: 400 });
  }
  if (!Number.isFinite(recallId) || recallId <= 0) {
    return NextResponse.json({ error: "Invalid recall." }, { status: 400 });
  }
  if (!odometerKm) {
    return NextResponse.json(
      { error: "Odometer KM is required." },
      { status: 400 },
    );
  }
  if (!/^\d+$/.test(odometerKm)) {
    return NextResponse.json(
      { error: "Odometer KM must be a whole number." },
      { status: 400 },
    );
  }

  const vehicle = await getVehicleForUser(user.id, vehicleId);
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  const recall = await getRecallById(recallId);
  if (!recall || recall.done) {
    return NextResponse.json(
      { error: "This recall is not available for an appointment request." },
      { status: 400 },
    );
  }

  const regMatch =
    vehicle.reg_no &&
    recall.reg_no &&
    vehicle.reg_no.trim().toUpperCase() === recall.reg_no.trim().toUpperCase();
  const vinMatch =
    vehicle.vin_number &&
    recall.vin_number &&
    vehicle.vin_number.trim().toUpperCase() ===
      recall.vin_number.trim().toUpperCase();
  if (!regMatch && !vinMatch) {
    return NextResponse.json(
      { error: "Recall does not match this vehicle." },
      { status: 400 },
    );
  }

  try {
    const result = await sendAppointmentRequestEmail({
      customerEmail: user.email,
      customerName: `${user.first_name} ${user.surname}`.trim(),
      telephone: user.telephone,
      city: user.city,
      regNo: vehicle.reg_no,
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
