import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateSemsAlerts,
  formatAlertNotes,
  getSemsAlertThresholds,
  type SemsAlertFinding,
} from "@/lib/sems/alert-rules";
import { SemsClient } from "@/lib/sems/client";
import type { SolarSiteConfig } from "@/lib/sems/sites";
import { listSolarSites, requireSolarSite } from "@/lib/sems/sites";
import { fetchDayEnergy } from "@/lib/sems/day-energy";
import {
  fetchConsumptionStats,
  formatSiteDate,
} from "@/lib/sems/consumption-stats";
import { fetchLiveFlow } from "@/lib/sems/flow";
import {
  upsertSolarLiveSnapshot,
  upsertSolarMonitoringLogByDate,
} from "@/lib/supabase/solar";
import type { SolarLiveSnapshot } from "@/lib/types/database";

function formatLocalDate(timeZone: string, at: Date = new Date()): string {
  return formatSiteDate(timeZone, at);
}

export type SemsSyncResult = {
  site_id: string;
  site_label: string;
  configured: boolean;
  snapshot: SolarLiveSnapshot | null;
  monitoringLogId: string | null;
  alerts: SemsAlertFinding[];
  error: string | null;
};

export async function syncSemsLiveForSite(
  supabase: SupabaseClient,
  config: SolarSiteConfig,
): Promise<SemsSyncResult> {
  const thresholds = getSemsAlertThresholds(config.timeZone);

  try {
    const client = new SemsClient(
      config.region,
      config.email,
      config.password,
    );
    const flow = await fetchLiveFlow(client, config.stationId);
    const dayEnergy = await fetchDayEnergy(client, config.stationId);
    const logDate = formatLocalDate(config.timeZone);

    let splits: Awaited<ReturnType<typeof fetchConsumptionStats>> | null =
      null;
    try {
      splits = await fetchConsumptionStats(client, config.stationId, {
        period: "day",
        anchorDate: logDate,
        timeZone: config.timeZone,
      });
    } catch {
      splits = null;
    }

    const generationToday =
      dayEnergy.generationTodayKwh ??
      splits?.generation_kwh ??
      flow.eGen ??
      null;
    const consumptionToday =
      dayEnergy.consumptionTodayKwh ??
      splits?.consumption_kwh ??
      flow.eUse ??
      null;
    const fetchedAt = new Date().toISOString();

    const alerts = evaluateSemsAlerts(
      {
        fetchedAt,
        pvPowerKw: flow.pSystem ?? null,
        batterySocPct: flow.soc ?? null,
        generationTodayKwh: generationToday,
      },
      thresholds,
    );

    const { data: snapshot, error: snapError } = await upsertSolarLiveSnapshot(
      supabase,
      {
        station_id: config.stationId,
        station_name: config.stationName ?? config.label,
        fetched_at: fetchedAt,
        pv_power_kw: flow.pSystem ?? null,
        load_power_kw: flow.pConsum ?? null,
        grid_power_kw: flow.pGrid ?? null,
        battery_power_kw: flow.pBat ?? null,
        battery_soc_pct: flow.soc ?? null,
        generation_today_kwh: generationToday,
        consumption_today_kwh: consumptionToday,
        raw: {
          ...flow.raw,
          _siteId: config.id,
          _siteLabel: config.label,
          _dayEnergySource:
            dayEnergy.generationTodayKwh != null ||
            dayEnergy.consumptionTodayKwh != null
              ? "telecounting"
              : splits
                ? "statistics"
                : "flow",
          _consumptionSplit: splits,
          _flowParsed: {
            pSystem: flow.pSystem ?? null,
            pConsum: flow.pConsum ?? null,
            pGrid: flow.pGrid ?? null,
            pBat: flow.pBat ?? null,
            soc: flow.soc ?? null,
          },
        },
        last_error: null,
      },
    );

    if (snapError) {
      throw new Error(snapError.message);
    }

    let monitoringLogId: string | null = null;

    const { data: logRow, error: logError } =
      await upsertSolarMonitoringLogByDate(supabase, {
        station_id: config.stationId,
        log_date: logDate,
        generation_kwh: generationToday,
        consumption_kwh: consumptionToday,
        ...(splits
          ? {
              to_load_kwh: splits.to_load_kwh,
              to_grid_kwh: splits.to_grid_kwh,
              from_grid_kwh: splits.from_grid_kwh,
              from_pv_bat_kwh: splits.from_pv_bat_kwh,
            }
          : {}),
        battery_soc_pct: flow.soc ?? null,
        alert_flag: alerts.length > 0,
        notes: formatAlertNotes(alerts),
      });
    if (logError) {
      throw new Error(logError.message);
    }
    monitoringLogId = logRow?.id ?? null;

    return {
      site_id: config.id,
      site_label: config.label,
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

    await upsertSolarLiveSnapshot(supabase, {
      station_id: config.stationId,
      station_name: config.stationName ?? config.label,
      last_error: message,
    });

    const logDate = formatLocalDate(config.timeZone);
    const existingLog = await supabase
      .from("solar_monitoring_log")
      .select("id, generation_kwh, consumption_kwh, battery_soc_pct")
      .eq("station_id", config.stationId)
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
        station_id: config.stationId,
        log_date: logDate,
        generation_kwh: null,
        consumption_kwh: null,
        battery_soc_pct: null,
        alert_flag: true,
        notes: formatAlertNotes(alerts),
      });
    }

    return {
      site_id: config.id,
      site_label: config.label,
      configured: true,
      snapshot: null,
      monitoringLogId: existingLog.data?.id ?? null,
      alerts,
      error: message,
    };
  }
}

/** Sync one site by slug/id, or the first configured site when omitted. */
export async function syncSemsLive(
  supabase: SupabaseClient,
  siteId?: string | null,
): Promise<SemsSyncResult> {
  let config: SolarSiteConfig;
  try {
    config = requireSolarSite(siteId);
  } catch (error) {
    return {
      site_id: siteId?.trim() ?? "",
      site_label: siteId?.trim() ?? "",
      configured: false,
      snapshot: null,
      monitoringLogId: null,
      alerts: [],
      error: error instanceof Error ? error.message : "Invalid SEMS config",
    };
  }

  return syncSemsLiveForSite(supabase, config);
}

/** Sync every configured SEMS site (cron / bulk refresh). */
export async function syncAllSemsLive(
  supabase: SupabaseClient,
): Promise<SemsSyncResult[]> {
  const sites = listSolarSites();
  if (!sites.length) {
    return [
      {
        site_id: "",
        site_label: "",
        configured: false,
        snapshot: null,
        monitoringLogId: null,
        alerts: [],
        error:
          "SEMS+ is not configured (set SEMS_SITES or legacy SEMS_* env vars)",
      },
    ];
  }

  const results: SemsSyncResult[] = [];
  for (const site of sites) {
    results.push(await syncSemsLiveForSite(supabase, site));
  }
  return results;
}
