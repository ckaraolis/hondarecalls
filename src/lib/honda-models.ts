/** Honda car models available when a user adds a vehicle. */
export const HONDA_CAR_MODELS = [
  "Accord",
  "Airwave",
  "Aria",
  "Ascot",
  "City",
  "Civic",
  "Concerto",
  "CR-V",
  "CR-Z",
  "Crossroad",
  "Domani",
  "Edix",
  "Elysion",
  "Fit",
  "Fit Aria",
  "Fit Shuttle",
  "FR-V",
  "Freed",
  "Grace",
  "HR-V",
  "Insight",
  "Inspire",
  "Integra",
  "Jazz",
  "Legend",
  "Logo",
  "Mobilio",
  "NSX",
  "Odyssey",
  "Partner",
  "Pilot",
  "Prelude",
  "Rafaga",
  "S2000",
  "S800",
  "Shuttle",
  "Spike",
  "Stepwgn",
  "Stream",
  "Torneo",
  "Vezel",
  "WR-V",
  "ZR-V",
  "Other",
] as const;

/** Honda motorcycle models available when a user adds a Motorbike. */
export const HONDA_MOTORCYCLE_MODELS = [
  "Africa Twin",
  "Transalp 750",
  "CB650R",
  "CB750 Hornet",
  "Forza 350",
  "ADV350",
  "SH350i",
  "PCX125",
  "Rebel 500",
  "NT1100",
  "Other",
] as const;

/** @deprecated Prefer HONDA_CAR_MODELS / modelsForVehicleType */
export const HONDA_VEHICLE_MODELS = HONDA_CAR_MODELS;

export type HondaVehicleModel =
  | (typeof HONDA_CAR_MODELS)[number]
  | (typeof HONDA_MOTORCYCLE_MODELS)[number];

export type VehicleTypeOption = "Car" | "Motorbike";

export function modelsForVehicleType(
  vehicleType: VehicleTypeOption,
): readonly string[] {
  return vehicleType === "Motorbike"
    ? HONDA_MOTORCYCLE_MODELS
    : HONDA_CAR_MODELS;
}

export function isHondaVehicleModel(
  value: string,
  vehicleType?: VehicleTypeOption,
): value is HondaVehicleModel {
  if (vehicleType) {
    return modelsForVehicleType(vehicleType).includes(value);
  }
  return (
    (HONDA_CAR_MODELS as readonly string[]).includes(value) ||
    (HONDA_MOTORCYCLE_MODELS as readonly string[]).includes(value)
  );
}
