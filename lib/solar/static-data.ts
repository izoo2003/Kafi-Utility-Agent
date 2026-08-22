import type { SolarMonitoringLog } from "@/lib/types/database";
import type {
  ConsumptionPeriod,
  ConsumptionStats,
} from "@/lib/sems/consumption-stats";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function sumField(
  logs: SolarMonitoringLog[],
  field: keyof Pick<
    SolarMonitoringLog,
    | "generation_kwh"
    | "consumption_kwh"
    | "to_load_kwh"
    | "to_grid_kwh"
    | "from_grid_kwh"
    | "from_pv_bat_kwh"
  >,
): number {
  return round2(
    logs.reduce((total, row) => total + (Number(row[field]) || 0), 0),
  );
}

/** Inclusive period bounds for a site-local anchor date (YYYY-MM-DD). */
export function staticPeriodBounds(
  period: ConsumptionPeriod,
  anchorDate: string,
): { start_date: string; end_date: string } {
  const [y, m, d] = anchorDate.split("-").map(Number);

  if (period === "day") {
    return { start_date: anchorDate, end_date: anchorDate };
  }

  if (period === "week") {
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    dt.setUTCDate(dt.getUTCDate() + diff);
    const start = dt.toISOString().slice(0, 10);
    const endDt = new Date(dt);
    endDt.setUTCDate(endDt.getUTCDate() + 6);
    return { start_date: start, end_date: endDt.toISOString().slice(0, 10) };
  }

  if (period === "month") {
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { start_date: start, end_date: end };
  }

  return {
    start_date: `${y}-01-01`,
    end_date: `${y}-12-31`,
  };
}

export function buildConsumptionStatsFromLogs(
  logs: SolarMonitoringLog[],
  period: ConsumptionPeriod,
  anchorDate: string,
): ConsumptionStats {
  const { start_date, end_date } = staticPeriodBounds(period, anchorDate);
  const inRange = logs.filter(
    (row) => row.log_date >= start_date && row.log_date <= end_date,
  );

  const generation_kwh = sumField(inRange, "generation_kwh");
  const consumption_kwh = sumField(inRange, "consumption_kwh");
  const to_load_kwh = sumField(inRange, "to_load_kwh");
  const to_grid_kwh = sumField(inRange, "to_grid_kwh");
  const from_grid_kwh = sumField(inRange, "from_grid_kwh");
  const from_pv_bat_kwh = sumField(inRange, "from_pv_bat_kwh");

  return {
    period,
    start_date,
    end_date,
    generation_kwh: generation_kwh > 0 ? generation_kwh : null,
    consumption_kwh: consumption_kwh > 0 ? consumption_kwh : null,
    to_load_kwh: to_load_kwh > 0 ? to_load_kwh : null,
    to_grid_kwh: to_grid_kwh >= 0 ? to_grid_kwh : null,
    from_pv_bat_kwh: from_pv_bat_kwh > 0 ? from_pv_bat_kwh : null,
    from_grid_kwh: from_grid_kwh > 0 ? from_grid_kwh : null,
  };
}

/** Map generation to on-site use when split fields are absent (grid-tied office). */
export function enrichGridTiedLogFields(generation_kwh: number) {
  const gen = round2(generation_kwh);
  return {
    generation_kwh: gen,
    consumption_kwh: gen,
    to_load_kwh: gen,
    to_grid_kwh: 0,
    from_pv_bat_kwh: gen,
    from_grid_kwh: 0,
  };
}
