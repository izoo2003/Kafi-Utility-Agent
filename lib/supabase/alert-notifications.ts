import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AlertNotification,
  AlertNotificationInsert,
} from "@/lib/types/database";

const TABLE = "alert_notifications" as const;

export async function listAlertNotificationsByIds(
  supabase: SupabaseClient,
  alertIds: string[],
) {
  if (alertIds.length === 0) {
    return { data: [] as AlertNotification[], error: null };
  }
  return supabase
    .from(TABLE)
    .select("*")
    .in("alert_id", alertIds)
    .returns<AlertNotification[]>();
}

export async function upsertAlertNotification(
  supabase: SupabaseClient,
  input: AlertNotificationInsert & { send_count: number },
) {
  return supabase
    .from(TABLE)
    .upsert(
      {
        ...input,
        last_sent_at: input.last_sent_at ?? new Date().toISOString(),
      },
      { onConflict: "alert_id" },
    )
    .select("*")
    .single()
    .returns<AlertNotification>();
}
