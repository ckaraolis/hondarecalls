import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { addVehicleForUser, listVehiclesForUser } from "@/lib/vehicles";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    vehicles: await listVehiclesForUser(user.id),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const vehicle = await addVehicleForUser(user.id, {
      reg_no: String(body.reg_no ?? ""),
      vin_number: String(body.vin_number ?? ""),
      vehicle_type: String(body.vehicle_type ?? "Car"),
      model: String(body.model ?? ""),
      year: String(body.year ?? ""),
      color: String(body.color ?? ""),
    });
    return NextResponse.json({ ok: true, vehicle });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not add vehicle.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
