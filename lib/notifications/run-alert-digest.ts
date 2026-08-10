import type { SupabaseClient } from "@supabase/supabase-js";
import { collectOpsAlerts } from "@/lib/alerts/collect";
import type { OpsAlert } from "@/lib/alerts/types";
import { formatAlertDigest } from "@/lib/notifications/format-digest";
import { sendAlertEmail } from "@/lib/notifications/send-email";
import {
  listAlertNotificationsByIds,
  upsertAlertNotification,
} from "@/lib/supabase/alert-notifications";

/** Re-notify the same open alert at most once per this window. */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type AlertDigestResult = {
  openAlerts: number;
  dueToNotify: number;
  sent: number;
  skippedCooldown: number;
  channel: "email" | "console" | "none";
  emailId?: string;
};

function isDue(
  lastSentAt: string | undefined,
  now: number,
  force: boolean,
) {
  if (force || !lastSentAt) return true;
  const t = Date.parse(lastSentAt);
  if (!Number.isFinite(t)) return true;
  return now - t >= COOLDOWN_MS;
}

export async function runAlertDigest(
  supabase: SupabaseClient,
  options: { force?: boolean } = {},
): Promise<AlertDigestResult> {
  const force = options.force === true;
  const alerts = await collectOpsAlerts(supabase);
  const now = Date.now();

  if (alerts.length === 0) {
    return {
      openAlerts: 0,
      dueToNotify: 0,
      sent: 0,
      skippedCooldown: 0,
      channel: "none",
    };
  }

  const { data: prior, error } = await listAlertNotificationsByIds(
    supabase,
    alerts.map((a) => a.id),
  );
  if (error) throw new Error(error.message);

  const priorById = new Map((prior ?? []).map((row) => [row.alert_id, row]));
  const due: OpsAlert[] = [];
  let skippedCooldown = 0;

  for (const alert of alerts) {
    const prev = priorById.get(alert.id);
    if (isDue(prev?.last_sent_at, now, force)) {
      due.push(alert);
    } else {
      skippedCooldown += 1;
    }
  }

  if (due.length === 0) {
    return {
      openAlerts: alerts.length,
      dueToNotify: 0,
      sent: 0,
      skippedCooldown,
      channel: "none",
    };
  }

  const digest = formatAlertDigest(due);
  const sendResult = await sendAlertEmail(digest);

  for (const alert of due) {
    const prev = priorById.get(alert.id);
    const { error: upsertError } = await upsertAlertNotification(supabase, {
      alert_id: alert.id,
      domain: alert.domain,
      severity: alert.severity,
      title: alert.title,
      detail: alert.detail,
      channel: sendResult.channel,
      send_count: (prev?.send_count ?? 0) + 1,
      last_sent_at: new Date().toISOString(),
    });
    if (upsertError) throw new Error(upsertError.message);
  }

  return {
    openAlerts: alerts.length,
    dueToNotify: due.length,
    sent: due.length,
    skippedCooldown,
    channel: sendResult.channel,
    emailId: sendResult.id,
  };
}
