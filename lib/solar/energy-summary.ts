import type { SupabaseClient } from "@supabase/supabase-js";
import type { SolarMonitoringLog } from "@/lib/types/database";
import { SemsClient } from "@/lib/sems/client";
import type { SemsConfig } from "@/lib/sems/config";
import {
  fetchConsumptionStats,
  formatSiteDate,
  type ConsumptionStats,
} from "@/lib/sems/consumption-stats";
import { listSolarMonitoringLog } from "@/lib/supabase/solar";

export type SolarMonthTotals = {
  month: string;
  label: string;
  generated_kwh: number;
  consumed_kwh: number;
  exported_kwh: number;
  to_load_kwh: number;
  from_grid_kwh: number;
  source: "sems" | "logs" | "mixed";
};

export type SolarEnergySummary = {
  month: string;
  start_date: string;
  end_date: string;
  site_id: string;
  site_label: string;
  station_id: string;
  station_name: string | null;
  /** Primary month KPIs (prefer SEMS). */
  generated_kwh: number | null;
  consumed_kwh: number | null;
  exported_kwh: number | null;
  to_load_kwh: number | null;
  from_grid_kwh: number | null;
  self_consumption_pct: number | null;
  export_pct: number | null;
  /** vs previous calendar month */
  vs_prev: {
    generated_pct: number | null;
    consumed_pct: number | null;
    exported_pct: number | null;
  };
  previous: SolarMonthTotals | null;
  month_trend: SolarMonthTotals[];
  daily: Array<{
    date: string;
    label: string;
    generated_kwh: number;
    consumed_kwh: number;
    exported_kwh: number;
  }>;
  comparison_bars: Array<{
    metric: string;
    this_month: number;
    last_month: number;
  }>;
  alerts: Array<{
    severity: "critical" | "warning" | "info";
    title: string;
    detail: string;
  }>;
  sems: ConsumptionStats | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function pctChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return round2(((current - previous) / previous) * 100);
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function monthAnchor(month: string): string {
  return `${month}-15`;
}

function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export function currentSiteMonth(timeZone = "Asia/Karachi"): string {
  return formatSiteDate(timeZone).slice(0, 7);
}

function aggregateLogsByMonth(
  logs: SolarMonitoringLog[],
  months: string[],
): Map<string, SolarMonthTotals> {
  const map = new Map<string, SolarMonthTotals>();
  for (const month of months) {
    map.set(month, {
      month,
      label: monthLabel(month),
      generated_kwh: 0,
      consumed_kwh: 0,
      exported_kwh: 0,
      to_load_kwh: 0,
      from_grid_kwh: 0,
      source: "logs",
    });
  }

  for (const row of logs) {
    const ym = row.log_date.slice(0, 7);
    const bucket = map.get(ym);
    if (!bucket) continue;
    bucket.generated_kwh = round2(
      bucket.generated_kwh + (Number(row.generation_kwh) || 0),
    );
    bucket.consumed_kwh = round2(
      bucket.consumed_kwh + (Number(row.consumption_kwh) || 0),
    );
    bucket.exported_kwh = round2(
      bucket.exported_kwh + (Number(row.to_grid_kwh) || 0),
    );
    bucket.to_load_kwh = round2(
      bucket.to_load_kwh + (Number(row.to_load_kwh) || 0),
    );
    bucket.from_grid_kwh = round2(
      bucket.from_grid_kwh + (Number(row.from_grid_kwh) || 0),
    );
  }
  return map;
}

function totalsFromSems(
  month: string,
  stats: ConsumptionStats,
): SolarMonthTotals {
  return {
    month,
    label: monthLabel(month),
    generated_kwh: round2(Number(stats.generation_kwh) || 0),
    consumed_kwh: round2(Number(stats.consumption_kwh) || 0),
    exported_kwh: round2(Number(stats.to_grid_kwh) || 0),
    to_load_kwh: round2(Number(stats.to_load_kwh) || 0),
    from_grid_kwh: round2(Number(stats.from_grid_kwh) || 0),
    source: "sems",
  };
}

function buildAlerts(
  current: SolarMonthTotals,
  previous: SolarMonthTotals | null,
  vs: SolarEnergySummary["vs_prev"],
): SolarEnergySummary["alerts"] {
  const alerts: SolarEnergySummary["alerts"] = [];

  if (!(current.generated_kwh > 0)) {
    alerts.push({
      severity: "warning",
      title: "Little or no generation this month",
      detail:
        "Generated units are near zero — check SEMS sync, inverter status, or weather/outages.",
    });
  }

  if (current.generated_kwh > 0 && current.exported_kwh / current.generated_kwh < 0.02) {
    alerts.push({
      severity: "info",
      title: "Almost all generation used on-site",
      detail: `Export is only ${round2((current.exported_kwh / current.generated_kwh) * 100)}% of generation — load is absorbing most PV.`,
    });
  }

  if (current.consumed_kwh > current.generated_kwh * 1.25 && current.generated_kwh > 0) {
    alerts.push({
      severity: "warning",
      title: "Consumption above generation",
      detail: `Consumed ${current.consumed_kwh} kWh vs generated ${current.generated_kwh} kWh — site is importing from the grid.`,
    });
  }

  if (vs.generated_pct != null && vs.generated_pct <= -20) {
    alerts.push({
      severity: "warning",
      title: "Generation down vs last month",
      detail: `Generated units are ${Math.abs(vs.generated_pct)}% lower than ${previous?.label ?? "last month"}.`,
    });
  } else if (vs.generated_pct != null && vs.generated_pct >= 20) {
    alerts.push({
      severity: "info",
      title: "Generation up vs last month",
      detail: `Generated units are ${vs.generated_pct}% higher than ${previous?.label ?? "last month"}.`,
    });
  }

  if (vs.exported_pct != null && vs.exported_pct >= 40) {
    alerts.push({
      severity: "info",
      title: "Grid export rising",
      detail: `Exported units are ${vs.exported_pct}% higher month-over-month.`,
    });
  }

  if (alerts.length === 0 && current.generated_kwh > 0) {
    alerts.push({
      severity: "info",
      title: "Month looks balanced",
      detail:
        "No sharp anomalies in generated / consumed / exported totals for this month.",
    });
  }

  return alerts;
}

/**
 * Monthly solar energy summary: generated, consumed, exported to grid,
 * with MoM comparison and multi-month trend (SEMS + monitoring logs).
 */
export async function buildSolarEnergySummary(
  supabase: SupabaseClient,
  config: SemsConfig,
  month: string,
): Promise<SolarEnergySummary> {
  const { start, end } = monthBounds(month);
  const prevMonth = addMonths(month, -1);
  const trendMonths = [0, -1, -2, -3, -4, -5].map((d) => addMonths(month, d)).reverse();

  const client = new SemsClient(
    config.region,
    config.email,
    config.password,
  );

  let semsCurrent: ConsumptionStats | null = null;
  let semsPrev: ConsumptionStats | null = null;

  if (config.static) {
    semsCurrent = null;
    semsPrev = null;
  } else {
    try {
      semsCurrent = await fetchConsumptionStats(client, config.stationId, {
        period: "month",
        anchorDate: monthAnchor(month),
        timeZone: config.timeZone,
      });
    } catch {
      semsCurrent = null;
    }

    try {
      semsPrev = await fetchConsumptionStats(client, config.stationId, {
        period: "month",
        anchorDate: monthAnchor(prevMonth),
        timeZone: config.timeZone,
      });
    } catch {
      semsPrev = null;
    }
  }

  const { data: logs, error: logsErr } = await listSolarMonitoringLog(
    supabase,
    config.stationId,
  );
  if (logsErr) throw new Error(logsErr.message);
  const allLogs = (logs ?? []) as SolarMonitoringLog[];

  const byMonth = aggregateLogsByMonth(allLogs, trendMonths);

  const currentFromLogs = byMonth.get(month)!;
  const current: SolarMonthTotals = semsCurrent
    ? totalsFromSems(month, semsCurrent)
    : currentFromLogs;

  const previousFromLogs = byMonth.get(prevMonth)!;
  const previous: SolarMonthTotals | null = semsPrev
    ? totalsFromSems(prevMonth, semsPrev)
    : previousFromLogs.generated_kwh > 0 || previousFromLogs.consumed_kwh > 0
      ? previousFromLogs
      : null;

  const month_trend: SolarMonthTotals[] = trendMonths.map((m) => {
    if (m === month && semsCurrent) return totalsFromSems(m, semsCurrent);
    if (m === prevMonth && semsPrev) return totalsFromSems(m, semsPrev);
    return byMonth.get(m)!;
  });

  const dailyMap = new Map<
    string,
    { generated_kwh: number; consumed_kwh: number; exported_kwh: number }
  >();
  for (const row of allLogs) {
    if (row.log_date < start || row.log_date > end) continue;
    dailyMap.set(row.log_date, {
      generated_kwh: round2(Number(row.generation_kwh) || 0),
      consumed_kwh: round2(Number(row.consumption_kwh) || 0),
      exported_kwh: round2(Number(row.to_grid_kwh) || 0),
    });
  }
  const daily: SolarEnergySummary["daily"] = [];
  for (
    let d = start;
    d <= end;
    d = (() => {
      const [y, m, day] = d.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, day + 1)).toISOString().slice(0, 10);
    })()
  ) {
    const point = dailyMap.get(d) ?? {
      generated_kwh: 0,
      consumed_kwh: 0,
      exported_kwh: 0,
    };
    daily.push({
      date: d,
      label: d.slice(8),
      ...point,
    });
  }

  const vs_prev = {
    generated_pct: previous
      ? pctChange(current.generated_kwh, previous.generated_kwh)
      : null,
    consumed_pct: previous
      ? pctChange(current.consumed_kwh, previous.consumed_kwh)
      : null,
    exported_pct: previous
      ? pctChange(current.exported_kwh, previous.exported_kwh)
      : null,
  };

  const self_consumption_pct =
    current.generated_kwh > 0
      ? round2((current.to_load_kwh / current.generated_kwh) * 100)
      : null;
  const export_pct =
    current.generated_kwh > 0
      ? round2((current.exported_kwh / current.generated_kwh) * 100)
      : null;

  return {
    month,
    start_date: start,
    end_date: end,
    site_id: config.id,
    site_label: config.label,
    station_id: config.stationId,
    station_name: config.stationName ?? config.label,
    generated_kwh: current.generated_kwh > 0 ? current.generated_kwh : null,
    consumed_kwh: current.consumed_kwh > 0 ? current.consumed_kwh : null,
    exported_kwh: current.exported_kwh >= 0 ? current.exported_kwh : null,
    to_load_kwh: current.to_load_kwh > 0 ? current.to_load_kwh : null,
    from_grid_kwh: current.from_grid_kwh > 0 ? current.from_grid_kwh : null,
    self_consumption_pct,
    export_pct,
    vs_prev,
    previous,
    month_trend,
    daily,
    comparison_bars: [
      {
        metric: "Generated",
        this_month: current.generated_kwh,
        last_month: previous?.generated_kwh ?? 0,
      },
      {
        metric: "Consumed",
        this_month: current.consumed_kwh,
        last_month: previous?.consumed_kwh ?? 0,
      },
      {
        metric: "Exported",
        this_month: current.exported_kwh,
        last_month: previous?.exported_kwh ?? 0,
      },
    ],
    alerts: buildAlerts(current, previous, vs_prev),
    sems: semsCurrent,
  };
}
