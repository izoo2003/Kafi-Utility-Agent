import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { SemsClient } from "@/lib/sems/client";
import { getSemsConfig, requireSolarSite } from "@/lib/sems/config";
import {
  isSolarSiteOffline,
  solarSiteOfflinePayload,
} from "@/lib/sems/site-offline";
import { isSolarSiteStatic, solarSiteStaticPayload } from "@/lib/sems/site-static";
import {
  fetchConsumptionStats,
  formatSiteDate,
  type ConsumptionPeriod,
} from "@/lib/sems/consumption-stats";
import { buildConsumptionStatsFromLogs } from "@/lib/solar/static-data";
import { listSolarMonitoringLog } from "@/lib/supabase/solar";

const PERIODS: ConsumptionPeriod[] = ["day", "week", "month", "year"];

function isPeriod(v: string | null): v is ConsumptionPeriod {
  return PERIODS.includes(v as ConsumptionPeriod);
}

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const siteParam = url.searchParams.get("site")?.trim() || null;
  const periodParam = url.searchParams.get("period") ?? "day";
  if (!isPeriod(periodParam)) {
    return NextResponse.json(
      { error: "period must be day|week|month|year" },
      { status: 400 },
    );
  }

  let config;
  try {
    config = siteParam ? requireSolarSite(siteParam) : getSemsConfig();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid SEMS config",
      },
      { status: 500 },
    );
  }
  if (!config) {
    return NextResponse.json(
      { error: "SEMS+ is not configured" },
      { status: 400 },
    );
  }
  if (isSolarSiteOffline(config)) {
    return NextResponse.json(solarSiteOfflinePayload(config.label), {
      status: 503,
    });
  }

  const anchor =
    url.searchParams.get("date")?.trim() ||
    formatSiteDate(config.timeZone);

  const logsResult = await listSolarMonitoringLog(supabase, config.stationId);
  if (logsResult.error) {
    return NextResponse.json(
      { error: logsResult.error.message },
      { status: 500 },
    );
  }
  const allLogs = logsResult.data ?? [];

  if (isSolarSiteStatic(config)) {
    const stats = buildConsumptionStatsFromLogs(
      allLogs,
      periodParam,
      anchor,
    );
    const inRange = allLogs.filter(
      (row) => row.log_date >= stats.start_date && row.log_date <= stats.end_date,
    );

    return NextResponse.json({
      ok: true,
      data: {
        stats,
        logs: inRange,
        site: {
          id: config.id,
          label: config.label,
          stationId: config.stationId,
          stationName: config.stationName ?? config.label,
        },
        station_name: config.stationName ?? config.label,
        ...solarSiteStaticPayload(config.label),
      },
    });
  }

  try {
    const client = new SemsClient(
      config.region,
      config.email,
      config.password,
    );
    const stats = await fetchConsumptionStats(client, config.stationId, {
      period: periodParam,
      anchorDate: anchor,
      timeZone: config.timeZone,
    });

    const inRange = allLogs.filter(
      (r) => r.log_date >= stats.start_date && r.log_date <= stats.end_date,
    );

    return NextResponse.json({
      ok: true,
      data: {
        stats,
        logs: inRange,
        site: {
          id: config.id,
          label: config.label,
          stationId: config.stationId,
          stationName: config.stationName ?? config.label,
        },
        station_name: config.stationName ?? config.label,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load consumption stats",
      },
      { status: 500 },
    );
  }
}
