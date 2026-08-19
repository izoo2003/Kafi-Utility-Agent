import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { SemsClient } from "@/lib/sems/client";
import { getSemsConfig } from "@/lib/sems/config";
import {
  fetchConsumptionStats,
  formatSiteDate,
  type ConsumptionPeriod,
} from "@/lib/sems/consumption-stats";
import { listSolarMonitoringLog } from "@/lib/supabase/solar";

const PERIODS: ConsumptionPeriod[] = ["day", "week", "month", "year"];

function isPeriod(v: string | null): v is ConsumptionPeriod {
  return PERIODS.includes(v as ConsumptionPeriod);
}

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period") ?? "day";
  if (!isPeriod(periodParam)) {
    return NextResponse.json(
      { error: "period must be day|week|month|year" },
      { status: 400 },
    );
  }

  let config;
  try {
    config = getSemsConfig();
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

  const anchor =
    url.searchParams.get("date")?.trim() ||
    formatSiteDate(config.timeZone);

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

    const logs = await listSolarMonitoringLog(supabase);
    const inRange = (logs.data ?? []).filter(
      (r) => r.log_date >= stats.start_date && r.log_date <= stats.end_date,
    );

    return NextResponse.json({
      ok: true,
      data: {
        stats,
        logs: inRange,
        station_name: config.stationName,
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
