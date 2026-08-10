import { NextRequest, NextResponse } from "next/server";
import { searchOpenRecallsForVehicle } from "@/lib/db";
import { getCurrentUser } from "@/lib/user-auth";
import { deleteVehicleForUser, getVehicleForUser } from "@/lib/vehicles";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const id = Number((await context.params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid vehicle id." }, { status: 400 });
  }

  const vehicle = await getVehicleForUser(user.id, id);
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  const recalls = await searchOpenRecallsForVehicle({
    reg_no: vehicle.reg_no,
    vin_number: vehicle.vin_number,
  });

  return NextResponse.json({ vehicle, recalls });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const id = Number((await context.params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid vehicle id." }, { status: 400 });
  }

  const deleted = await deleteVehicleForUser(user.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
