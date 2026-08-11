import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateSemsAlerts,
  formatAlertNotes,
  getSemsAlertThresholds,
  type SemsAlertFinding,
} from "@/lib/sems/alert-rules";
import { SemsClient } from "@/lib/sems/client";
import { getSemsConfig } from "@/lib/sems/config";
import { fetchLiveFlow } from "@/lib/sems/flow";
import {
  upsertSolarLiveSnapshot,
  upsertSolarMonitoringLogByDate,
} from "@/lib/supabase/solar";
import type { SolarLiveSnapshot } from "@/lib/types/database";

function formatLocalDate(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export type SemsSyncResult = {
  configured: boolean;
  snapshot: SolarLiveSnapshot | null;
  monitoringLogId: string | null;
  alerts: SemsAlertFinding[];
  error: string | null;
};

export async function syncSemsLive(
  supabase: SupabaseClient,
): Promise<SemsSyncResult> {
  let config;
  try {
    config = getSemsConfig();
  } catch (error) {
    return {
      configured: false,
      snapshot: null,
      monitoringLogId: null,
      alerts: [],
      error: error instanceof Error ? error.message : "Invalid SEMS config",
    };
  }

  if (!config) {
    return {
      configured: false,
      snapshot: null,
      monitoringLogId: null,
      alerts: [],
      error:
        "SEMS+ is not configured (set SEMS_EMAIL, SEMS_PASSWORD, SEMS_STATION_ID)",
    };
  }

  const thresholds = getSemsAlertThresholds(config.timeZone);

  try {
    const client = new SemsClient(
      config.region,
      config.email,
      config.password,
    );
    const flow = await fetchLiveFlow(client, config.stationId);
    const fetchedAt = new Date().toISOString();

    const alerts = evaluateSemsAlerts(
      {
        fetchedAt,
        pvPowerKw: flow.pSystem ?? null,
        batterySocPct: flow.soc ?? null,
        generationTodayKwh: flow.eGen ?? null,
      },
      thresholds,
    );

    const { data: snapshot, error: snapError } = await upsertSolarLiveSnapshot(
      supabase,
      {
        station_id: config.stationId,
        station_name: config.stationName,
        fetched_at: fetchedAt,
        pv_power_kw: flow.pSystem ?? null,
        load_power_kw: flow.pConsum ?? null,
        grid_power_kw: flow.pGrid ?? null,
        battery_power_kw: flow.pBat ?? null,
        battery_soc_pct: flow.soc ?? null,
        generation_today_kwh: flow.eGen ?? null,
        consumption_today_kwh: flow.eUse ?? null,
        raw: flow.raw,
        last_error: null,
      },
    );

    if (snapError) {
      throw new Error(snapError.message);
    }

    const logDate = formatLocalDate(config.timeZone);
    let monitoringLogId: string | null = null;

    const { data: logRow, error: logError } =
      await upsertSolarMonitoringLogByDate(supabase, {
        log_date: logDate,
        generation_kwh: flow.eGen ?? null,
        consumption_kwh: flow.eUse ?? null,
        battery_soc_pct: flow.soc ?? null,
        alert_flag: alerts.length > 0,
        notes: formatAlertNotes(alerts),
      });
    if (logError) {
      throw new Error(logError.message);
    }
    monitoringLogId = logRow?.id ?? null;

    return {
      configured: true,
      snapshot: snapshot as SolarLiveSnapshot,
      monitoringLogId,
      alerts,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SEMS+ sync failed";

    const alerts = evaluateSemsAlerts(
      { syncFailed: true, lastError: message },
      thresholds,
    );

    // Only stamp the error — do not wipe last good telemetry columns.
    await upsertSolarLiveSnapshot(supabase, {
      station_id: config.stationId,
      station_name: config.stationName,
      last_error: message,
    });

    const logDate = formatLocalDate(config.timeZone);
    const existingLog = await supabase
      .from("solar_monitoring_log")
      .select("id, generation_kwh, consumption_kwh, battery_soc_pct")
      .eq("log_date", logDate)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLog.data) {
      await supabase
        .from("solar_monitoring_log")
        .update({
          alert_flag: true,
          notes: formatAlertNotes(alerts),
        })
        .eq("id", existingLog.data.id);
    } else {
      await upsertSolarMonitoringLogByDate(supabase, {
        log_date: logDate,
        generation_kwh: null,
        consumption_kwh: null,
        battery_soc_pct: null,
        alert_flag: true,
        notes: formatAlertNotes(alerts),
      });
    }

    return {
      configured: true,
      snapshot: null,
      monitoringLogId: existingLog.data?.id ?? null,
      alerts,
      error: message,
    };
  }
}
