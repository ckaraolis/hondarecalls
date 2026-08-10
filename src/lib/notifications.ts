import type { PublicRecall } from "@/lib/db";
import { getSupabase, normalizeIdentity } from "@/lib/supabase";

export type AppNotification = {
  id: number;
  user_id: number;
  title: string;
  body: string;
  reg_no: string;
  recall_no: string;
  read_at: string | null;
  created_at: string;
};

function mapNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    reg_no: String(row.reg_no ?? ""),
    recall_no: String(row.recall_no ?? ""),
    read_at: row.read_at == null ? null : String(row.read_at),
    created_at: String(row.created_at ?? ""),
  };
}

export async function findUserIdsForRecall(row: {
  reg_no: string;
  vin_number: string;
}): Promise<number[]> {
  const reg = normalizeIdentity(row.reg_no);
  const vin = normalizeIdentity(row.vin_number);
  if (!reg && !vin) return [];

  const supabase = getSupabase();
  let query = supabase.from("user_vehicles").select("user_id");

  if (reg && vin) {
    query = query.or(`reg_no_norm.eq."${reg}",vin_number_norm.eq."${vin}"`);
  } else if (reg) {
    query = query.eq("reg_no_norm", reg);
  } else {
    query = query.eq("vin_number_norm", vin);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return [...new Set((data ?? []).map((r) => Number(r.user_id)))];
}

export async function createNotification(input: {
  user_id: number;
  title: string;
  body: string;
  reg_no: string;
  recall_no: string;
}): Promise<AppNotification | null> {
  const supabase = getSupabase();
  const payload = {
    user_id: input.user_id,
    title: input.title,
    body: input.body,
    reg_no: input.reg_no.trim().toUpperCase(),
    recall_no: input.recall_no.trim(),
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select(
      "id, user_id, title, body, reg_no, recall_no, read_at, created_at",
    )
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return null;
    throw new Error(error.message);
  }

  return data ? mapNotification(data as Record<string, unknown>) : null;
}

export async function listNotificationsForUser(
  userId: number,
  limit = 30,
): Promise<AppNotification[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, user_id, title, body, reg_no, recall_no, read_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapNotification(row as Record<string, unknown>),
  );
}

export async function countUnreadNotifications(userId: number): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationRead(
  userId: number,
  notificationId: number,
): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id");

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function markAllNotificationsRead(userId: number): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export type PushSubscriptionRow = {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function savePushSubscription(
  userId: number,
  input: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) throw new Error(error.message);
}

export async function deletePushSubscription(
  userId: number,
  endpoint: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .select("id");

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}

export async function listPushSubscriptionsForUser(
  userId: number,
): Promise<PushSubscriptionRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    endpoint: String(row.endpoint ?? ""),
    p256dh: String(row.p256dh ?? ""),
    auth: String(row.auth ?? ""),
  }));
}

export function buildRecallAlertCopy(row: PublicRecall) {
  const reg = row.reg_no.trim().toUpperCase() || "your vehicle";
  const recall = row.recall_no.trim() || "new";
  return {
    title: `Honda recall ${recall}`,
    body: `New recall for ${reg}. Open your account for details.`,
    reg_no: row.reg_no.trim().toUpperCase(),
    recall_no: row.recall_no.trim(),
  };
}
