import type { SemsClient } from "@/lib/sems/client";

function unwrapData(json: unknown): unknown {
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export type ConsumptionPeriod = "day" | "week" | "month" | "year";

export type ConsumptionStats = {
  period: ConsumptionPeriod;
  /** Inclusive start YYYY-MM-DD (site local) */
  start_date: string;
  /** Inclusive end YYYY-MM-DD (site local) */
  end_date: string;
  generation_kwh: number | null;
  to_load_kwh: number | null;
  to_grid_kwh: number | null;
  consumption_kwh: number | null;
  from_pv_bat_kwh: number | null;
  from_grid_kwh: number | null;
};

type PowerSample = { tp: string; power: number | null };

function parseLocalMs(tp: string, timeZone: string): number {
  // SEMS returns "YYYY-MM-DD HH:mm:ss" in station local time.
  const isoish = tp.includes("T") ? tp : tp.replace(" ", "T");
  // Prefer explicit offset for Asia/Karachi (+05:00, no DST).
  if (timeZone === "Asia/Karachi" || timeZone === "PKT") {
    return Date.parse(`${isoish}+05:00`);
  }
  const parsed = Date.parse(isoish);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function integrateSeries(
  samples: PowerSample[],
  timeZone: string,
): { abs: number; positive: number; negative: number } {
  let abs = 0;
  let positive = 0;
  let negative = 0;
  if (samples.length < 2) return { abs, positive, negative };

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]!;
    const cur = samples[i]!;
    const p = cur.power;
    if (p == null || !Number.isFinite(p)) continue;
    const t0 = parseLocalMs(prev.tp, timeZone);
    const t1 = parseLocalMs(cur.tp, timeZone);
    let hours = (t1 - t0) / 3_600_000;
    if (!Number.isFinite(hours) || hours <= 0 || hours > 2) {
      hours = 1 / 60;
    }
    const e = p * hours;
    abs += Math.abs(e);
    if (e >= 0) positive += e;
    else negative += Math.abs(e);
  }
  return { abs, positive, negative };
}

function collectDataList(
  data: unknown,
): Map<string, PowerSample[]> {
  const map = new Map<string, PowerSample[]>();
  if (!data || typeof data !== "object") return map;
  const dataList = (data as { dataList?: unknown }).dataList;
  if (!Array.isArray(dataList)) return map;

  for (const entry of dataList) {
    if (!entry || typeof entry !== "object") continue;
    const item = String((entry as { item?: unknown }).item ?? "");
    const powerData = (entry as { powerData?: unknown }).powerData;
    if (!item || !Array.isArray(powerData)) continue;
    const samples: PowerSample[] = [];
    for (const sample of powerData) {
      if (!sample || typeof sample !== "object") continue;
      const s = sample as Record<string, unknown>;
      const tp = String(s.tp ?? s.time ?? s.dateTime ?? "");
      if (!tp) continue;
      samples.push({
        tp,
        power: asNumber(s.power ?? s.value) ?? null,
      });
    }
    map.set(item, samples);
  }
  return map;
}

/** Site-local calendar date helpers (Asia/Karachi-safe via en-CA + timeZone). */
export function siteDateParts(timeZone: string, at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

export function formatSiteDate(timeZone: string, at: Date = new Date()) {
  const { year, month, day } = siteDateParts(timeZone, at);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function startOfWeekMonday(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0 Sun
  const delta = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function periodWindow(
  period: ConsumptionPeriod,
  anchorIso: string,
): { start: string; end: string; startTime: string; endTime: string } {
  if (period === "day") {
    return {
      start: anchorIso,
      end: anchorIso,
      startTime: `${anchorIso} 00:00:00`,
      endTime: `${anchorIso} 23:59:59`,
    };
  }
  if (period === "week") {
    const start = startOfWeekMonday(anchorIso);
    const end = addCalendarDays(start, 6);
    return {
      start,
      end,
      startTime: `${start} 00:00:00`,
      endTime: `${end} 23:59:59`,
    };
  }
  if (period === "month") {
    const [y, m] = anchorIso.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDt = new Date(Date.UTC(y, m, 0)); // last day of month
    const end = endDt.toISOString().slice(0, 10);
    return {
      start,
      end,
      startTime: `${start} 00:00:00`,
      endTime: `${end} 23:59:59`,
    };
  }
  const y = Number(anchorIso.slice(0, 4));
  const start = `${y}-01-01`;
  const end = `${y}-12-31`;
  return {
    start,
    end,
    startTime: `${start} 00:00:00`,
    endTime: `${end} 23:59:59`,
  };
}

/**
 * Fetch AC generation / consumption split for a period from SEMS+ power charts.
 * To Load / To Grid come from integrating pSystem and signed pGrid (export = to grid).
 * From PV&BAT / From Grid come from pConsum and signed pGrid (import = from grid).
 */
export async function fetchConsumptionStats(
  client: SemsClient,
  stationId: string,
  opts: {
    period: ConsumptionPeriod;
    anchorDate: string;
    timeZone: string;
  },
): Promise<ConsumptionStats> {
  const window = periodWindow(opts.period, opts.anchorDate);

  const json = await client.request(
    "POST",
    "/sems-plant/api/v1/hems/power/statisticsAndPreV2",
    {
      body: {
        stationId,
        items: ["pSystem", "pConsum", "pGrid", "pBat", "soc"],
        timeScale: 1,
        timeZone: opts.timeZone,
        startTime: window.startTime,
        endTime: window.endTime,
      },
    },
  );

  const series = collectDataList(unwrapData(json));
  const pv = integrateSeries(series.get("pSystem") ?? [], opts.timeZone);
  const load = integrateSeries(series.get("pConsum") ?? [], opts.timeZone);
  const grid = integrateSeries(series.get("pGrid") ?? [], opts.timeZone);

  // SEMS convention observed: negative pGrid ≈ export (to grid), positive ≈ import.
  const toGrid = round3(grid.negative);
  const fromGrid = round3(grid.positive);
  const generation = round3(pv.abs);
  const consumption = round3(load.abs);
  const toLoad = round3(Math.max(0, generation - toGrid));
  const fromPvBat = round3(Math.max(0, consumption - fromGrid));

  return {
    period: opts.period,
    start_date: window.start,
    end_date: window.end,
    generation_kwh: generation > 0 ? generation : null,
    to_load_kwh: generation > 0 ? toLoad : null,
    to_grid_kwh: generation > 0 ? toGrid : null,
    consumption_kwh: consumption > 0 ? consumption : null,
    from_pv_bat_kwh: consumption > 0 ? fromPvBat : null,
    from_grid_kwh: consumption > 0 ? fromGrid : null,
  };
}
