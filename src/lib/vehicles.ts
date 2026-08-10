import { getSupabase, normalizeIdentity } from "@/lib/supabase";

export type UserVehicle = {
  id: number;
  user_id: number;
  reg_no: string;
  vin_number: string;
  vehicle_type: "Car" | "Motorbike";
  model: string;
  year: string;
  color: string;
  created_at: string;
};

function normalizeReg(reg: string) {
  return reg.trim().toUpperCase().replace(/\s+/g, "");
}

function mapVehicle(row: Record<string, unknown>): UserVehicle {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    reg_no: String(row.reg_no ?? ""),
    vin_number: String(row.vin_number ?? ""),
    vehicle_type:
      String(row.vehicle_type) === "Motorbike" ? "Motorbike" : "Car",
    model: String(row.model ?? ""),
    year: String(row.year ?? ""),
    color: String(row.color ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export async function listVehiclesForUser(
  userId: number,
): Promise<UserVehicle[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_vehicles")
    .select(
      "id, user_id, reg_no, vin_number, vehicle_type, model, year, color, created_at",
    )
    .eq("user_id", userId)
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapVehicle(row as Record<string, unknown>));
}

export async function getVehicleForUser(
  userId: number,
  vehicleId: number,
): Promise<UserVehicle | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_vehicles")
    .select(
      "id, user_id, reg_no, vin_number, vehicle_type, model, year, color, created_at",
    )
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapVehicle(data as Record<string, unknown>) : null;
}

export async function addVehicleForUser(
  userId: number,
  input: {
    reg_no: string;
    vin_number?: string;
    vehicle_type: string;
    model: string;
    year: string;
    color: string;
  },
): Promise<UserVehicle> {
  const reg_no = normalizeReg(input.reg_no);
  if (!reg_no) {
    throw new Error("Registration number is required.");
  }

  const vehicle_type =
    input.vehicle_type === "Motorbike" ? "Motorbike" : "Car";
  const vin_number = (input.vin_number || "").trim().toUpperCase();
  const model = input.model.trim();
  const year = input.year.trim();
  const color = input.color.trim();

  if (!model) throw new Error("Model is required.");
  if (!year) throw new Error("Year is required.");
  if (!color) throw new Error("Color is required.");
  if (!/^\d{4}$/.test(year)) {
    throw new Error("Year must be a 4-digit number.");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_vehicles")
    .insert({
      user_id: userId,
      reg_no,
      vin_number,
      reg_no_norm: normalizeIdentity(reg_no),
      vin_number_norm: normalizeIdentity(vin_number),
      vehicle_type,
      model,
      year,
      color,
    })
    .select(
      "id, user_id, reg_no, vin_number, vehicle_type, model, year, color, created_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "You already added a vehicle with this registration number.",
      );
    }
    throw new Error(error.message);
  }

  return mapVehicle(data as Record<string, unknown>);
}

export async function deleteVehicleForUser(
  userId: number,
  vehicleId: number,
): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_vehicles")
    .delete()
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .select("id");

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}
