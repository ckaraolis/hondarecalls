import { getSupabase, normalizeIdentity } from "@/lib/supabase";

export type Recall = {
  id: number;
  reg_no: string;
  vin_number: string;
  model: string;
  recall_no: string;
  description: string;
  part_number: string;
  surname: string;
  first_name: string;
  telephone: string;
  city: string;
  done: number;
  sms_sent: number;
  registration_date: string;
  engine_number: string;
};

/** Public-safe recall fields (no owner/phone). */
export type PublicRecall = {
  id: number;
  reg_no: string;
  vin_number: string;
  model: string;
  recall_no: string;
  description: string;
  part_number: string;
};

export type UpsertResult = {
  added: number;
  updated: number;
  skipped: number;
  total: number;
  addedRows: PublicRecall[];
};

export type RecallGroup = {
  recall_no: string;
  count: number;
};

const RECALL_COLUMNS =
  "id, reg_no, vin_number, model, recall_no, description, part_number, surname, first_name, telephone, city, done, sms_sent, registration_date, engine_number";

export const SMS_MAX_LENGTH = 160;

export const DEFAULT_SMS_TEMPLATE =
  "Honda recall {recall_no} for {reg}. Please visit an authorized Honda garage.";

function normalize(value: string) {
  return normalizeIdentity(value);
}

function asNumber(value: unknown) {
  return Number(value) ? 1 : 0;
}

function mapRecall(row: Record<string, unknown>): Recall {
  return {
    id: Number(row.id),
    reg_no: String(row.reg_no ?? ""),
    vin_number: String(row.vin_number ?? ""),
    model: String(row.model ?? ""),
    recall_no: String(row.recall_no ?? ""),
    description: String(row.description ?? ""),
    part_number: String(row.part_number ?? ""),
    surname: String(row.surname ?? ""),
    first_name: String(row.first_name ?? ""),
    telephone: String(row.telephone ?? ""),
    city: String(row.city ?? ""),
    done: asNumber(row.done),
    sms_sent: asNumber(row.sms_sent),
    registration_date: String(row.registration_date ?? ""),
    engine_number: String(row.engine_number ?? ""),
  };
}

export function formatOwnerName(row: {
  surname: string;
  first_name: string;
}) {
  return [row.first_name.trim(), row.surname.trim()].filter(Boolean).join(" ");
}

/** Unique vehicle+recall key: same car can have many recalls if Recall No differs. */
export function recallIdentityKey(row: {
  reg_no: string;
  vin_number: string;
  recall_no: string;
}) {
  const vin = normalize(row.vin_number);
  const reg = normalize(row.reg_no);
  const recall = normalize(row.recall_no);
  const vehicle = vin || reg || "";
  return `${vehicle}::${recall}`;
}

export function toPublicRecall(row: Recall): PublicRecall {
  return {
    id: row.id,
    reg_no: row.reg_no,
    vin_number: row.vin_number,
    model: row.model,
    recall_no: row.recall_no,
    description: row.description,
    part_number: row.part_number,
  };
}

export async function getSmsTemplate(): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "sms_template")
    .maybeSingle();

  if (error) throw new Error(error.message);
  const value = data?.value?.trim();
  return value || DEFAULT_SMS_TEMPLATE;
}

export async function setSmsTemplate(template: string): Promise<string> {
  const trimmed = template.trim();
  if (!trimmed) {
    throw new Error("SMS template cannot be empty.");
  }
  if (trimmed.length > SMS_MAX_LENGTH) {
    throw new Error(`SMS template must be ${SMS_MAX_LENGTH} characters or less.`);
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("settings").upsert({
    key: "sms_template",
    value: trimmed,
  });

  if (error) throw new Error(error.message);
  return trimmed;
}

export async function searchRecalls(query: string): Promise<PublicRecall[]> {
  const q = normalize(query);
  if (!q) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("recalls")
    .select("id, reg_no, vin_number, model, recall_no, description, part_number")
    .or(`reg_no_norm.eq."${q}",vin_number_norm.eq."${q}"`)
    .order("recall_no", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: Number(row.id),
    reg_no: String(row.reg_no ?? ""),
    vin_number: String(row.vin_number ?? ""),
    model: String(row.model ?? ""),
    recall_no: String(row.recall_no ?? ""),
    description: String(row.description ?? ""),
    part_number: String(row.part_number ?? ""),
  }));
}

/** Open (not Done) recalls matching a vehicle's reg and/or VIN. */
export async function searchOpenRecallsForVehicle(input: {
  reg_no: string;
  vin_number?: string;
}): Promise<PublicRecall[]> {
  const reg = normalize(input.reg_no);
  const vin = normalize(input.vin_number || "");
  if (!reg && !vin) return [];

  const supabase = getSupabase();
  let query = supabase
    .from("recalls")
    .select("id, reg_no, vin_number, model, recall_no, description, part_number")
    .eq("done", 0)
    .order("recall_no", { ascending: true });

  if (reg && vin) {
    query = query.or(`reg_no_norm.eq."${reg}",vin_number_norm.eq."${vin}"`);
  } else if (reg) {
    query = query.eq("reg_no_norm", reg);
  } else {
    query = query.eq("vin_number_norm", vin);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: Number(row.id),
    reg_no: String(row.reg_no ?? ""),
    vin_number: String(row.vin_number ?? ""),
    model: String(row.model ?? ""),
    recall_no: String(row.recall_no ?? ""),
    description: String(row.description ?? ""),
    part_number: String(row.part_number ?? ""),
  }));
}

/**
 * Merge Excel rows into the database.
 * - Inserts when Recall No is new for that vehicle (VIN preferred, else Reg. No)
 * - On same vehicle + Recall No: updates contact/Done fields (no duplicate row)
 */
export async function upsertRecalls(
  rows: Omit<Recall, "id" | "sms_sent">[],
): Promise<UpsertResult> {
  const supabase = getSupabase();

  const { data: existingRows, error: existingError } = await supabase
    .from("recalls")
    .select("id, reg_no, vin_number, recall_no");

  if (existingError) throw new Error(existingError.message);

  const existingByKey = new Map(
    (existingRows ?? []).map((row) => [
      recallIdentityKey({
        reg_no: String(row.reg_no ?? ""),
        vin_number: String(row.vin_number ?? ""),
        recall_no: String(row.recall_no ?? ""),
      }),
      Number(row.id),
    ]),
  );

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const addedRows: PublicRecall[] = [];

  for (const item of rows) {
    const key = recallIdentityKey(item);
    if (
      !item.recall_no.trim() &&
      !normalize(item.vin_number) &&
      !normalize(item.reg_no)
    ) {
      skipped += 1;
      continue;
    }

    const existingId = existingByKey.get(key);
    const done = item.done ? 1 : 0;
    const reg_no_norm = normalize(item.reg_no);
    const vin_number_norm = normalize(item.vin_number);

    if (existingId !== undefined) {
      const { data: current, error: currentError } = await supabase
        .from("recalls")
        .select(RECALL_COLUMNS)
        .eq("id", existingId)
        .maybeSingle();

      if (currentError) throw new Error(currentError.message);
      if (!current) continue;

      const next = {
        reg_no: item.reg_no || String(current.reg_no ?? ""),
        vin_number: item.vin_number || String(current.vin_number ?? ""),
        model: item.model || String(current.model ?? ""),
        description: item.description || String(current.description ?? ""),
        part_number: item.part_number || String(current.part_number ?? ""),
        surname: item.surname || String(current.surname ?? ""),
        first_name: item.first_name || String(current.first_name ?? ""),
        telephone: item.telephone || String(current.telephone ?? ""),
        city: item.city || String(current.city ?? ""),
        registration_date:
          item.registration_date || String(current.registration_date ?? ""),
        engine_number: item.engine_number || String(current.engine_number ?? ""),
        done,
        reg_no_norm: normalize(item.reg_no || String(current.reg_no ?? "")),
        vin_number_norm: normalize(
          item.vin_number || String(current.vin_number ?? ""),
        ),
      };

      const { error: updateError } = await supabase
        .from("recalls")
        .update(next)
        .eq("id", existingId);

      if (updateError) throw new Error(updateError.message);
      updated += 1;
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("recalls")
      .insert({
        reg_no: item.reg_no,
        vin_number: item.vin_number,
        reg_no_norm,
        vin_number_norm,
        model: item.model,
        recall_no: item.recall_no,
        description: item.description,
        part_number: item.part_number,
        surname: item.surname,
        first_name: item.first_name,
        telephone: item.telephone,
        city: item.city,
        registration_date: item.registration_date,
        engine_number: item.engine_number,
        done,
        sms_sent: 0,
      })
      .select(
        "id, reg_no, vin_number, model, recall_no, description, part_number",
      )
      .single();

    if (insertError) throw new Error(insertError.message);

    const id = Number(inserted.id);
    existingByKey.set(key, id);
    added += 1;
    addedRows.push({
      id,
      reg_no: String(inserted.reg_no ?? item.reg_no),
      vin_number: String(inserted.vin_number ?? item.vin_number),
      model: String(inserted.model ?? item.model),
      recall_no: String(inserted.recall_no ?? item.recall_no),
      description: String(inserted.description ?? item.description),
      part_number: String(inserted.part_number ?? item.part_number),
    });
  }

  const total = await getRecallCount();
  return { added, updated, skipped, total, addedRows };
}

export async function getRecallCount(): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("recalls")
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getRecallById(id: number): Promise<Recall | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("recalls")
    .select(RECALL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRecall(data as Record<string, unknown>) : null;
}

export async function updateRecall(
  id: number,
  data: Omit<Recall, "id">,
): Promise<Recall | null> {
  const supabase = getSupabase();
  const { data: existing, error: existingError } = await supabase
    .from("recalls")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (!existing) return null;

  const { error } = await supabase
    .from("recalls")
    .update({
      reg_no: data.reg_no,
      vin_number: data.vin_number,
      reg_no_norm: normalize(data.reg_no),
      vin_number_norm: normalize(data.vin_number),
      model: data.model,
      recall_no: data.recall_no,
      description: data.description,
      part_number: data.part_number,
      surname: data.surname,
      first_name: data.first_name,
      telephone: data.telephone,
      city: data.city,
      registration_date: data.registration_date,
      engine_number: data.engine_number,
      done: data.done ? 1 : 0,
      sms_sent: data.sms_sent ? 1 : 0,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  return getRecallById(id);
}

export async function deleteRecall(id: number): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("recalls")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/** Deletes every row for a Recall No. campaign. */
export async function deleteRecallCampaign(recallNo: string): Promise<{
  deleted: number;
}> {
  const supabase = getSupabase();

  if (recallNo === "(No Recall No.)") {
    const { data, error } = await supabase
      .from("recalls")
      .delete()
      .eq("recall_no", "")
      .select("id");
    if (error) throw new Error(error.message);
    return { deleted: data?.length ?? 0 };
  }

  const { data, error } = await supabase
    .from("recalls")
    .delete()
    .eq("recall_no", recallNo)
    .select("id");

  if (error) throw new Error(error.message);
  return { deleted: data?.length ?? 0 };
}

export async function markSmsSent(id: number): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("recalls")
    .update({ sms_sent: 1 })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markSmsSentMany(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("recalls")
    .update({ sms_sent: 1 })
    .in("id", ids);
  if (error) throw new Error(error.message);
}

export async function listRecallGroups(): Promise<RecallGroup[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("recalls").select("recall_no");
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key =
      String(row.recall_no ?? "").trim() === ""
        ? "(No Recall No.)"
        : String(row.recall_no);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([recall_no, count]) => ({ recall_no, count }))
    .sort((a, b) => a.recall_no.localeCompare(b.recall_no));
}

export async function listRecallsByRecallNo(
  recallNo: string | null,
): Promise<Recall[]> {
  const supabase = getSupabase();

  if (!recallNo || recallNo === "all") {
    const { data, error } = await supabase
      .from("recalls")
      .select(RECALL_COLUMNS)
      .order("recall_no", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRecall(row as Record<string, unknown>));
  }

  if (recallNo === "(No Recall No.)") {
    const { data, error } = await supabase
      .from("recalls")
      .select(RECALL_COLUMNS)
      .eq("recall_no", "")
      .order("id", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRecall(row as Record<string, unknown>));
  }

  const { data, error } = await supabase
    .from("recalls")
    .select(RECALL_COLUMNS)
    .eq("recall_no", recallNo)
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRecall(row as Record<string, unknown>));
}
