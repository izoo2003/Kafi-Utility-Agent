import type { SolarLiveSnapshotUpsert } from "@/lib/types/database";
import { enrichGridTiedLogFields } from "@/lib/solar/static-data";

/** Matches SEMS_SITES entry id in .env */
export const SUNGROW_OFFICE_SITE_ID = "sungrow-office";

export const SUNGROW_OFFICE_STATION_ID =
  "c4e8f2a1-9b3d-4e5f-a6c7-8d9e0f1a2b3c";

/** Last on-site Bluetooth capture (iSolarCloud), 22 Aug 2026 ~17:40 PKT. */
export const SUNGROW_CAPTURE_DATE = "2026-08-22";
export const SUNGROW_CAPTURE_ISO = "2026-08-22T12:40:00.000Z";

export const sungrowOfficeSpecs = {
  panel_capacity_kw: 33.0,
  inverter_model: "SG33CX",
  vendor: "Sungrow · serial A2170302957 · iSolarCloud static archive",
};

export const sungrowOfficeSnapshot: SolarLiveSnapshotUpsert = {
  station_id: SUNGROW_OFFICE_STATION_ID,
  station_name: "SunGrow Office",
  fetched_at: SUNGROW_CAPTURE_ISO,
  pv_power_kw: 0.394,
  load_power_kw: 0.485,
  grid_power_kw: 0,
  battery_power_kw: null,
  battery_soc_pct: null,
  generation_today_kwh: 37.4,
  consumption_today_kwh: 37.4,
  raw: {
    source: "static",
    app: "iSolarCloud",
    inverter_model: "SG33CX",
    inverter_serial: "A2170302957",
    rated_kwp: 33,
    total_dc_power_w: 394,
    total_active_power_w: 485,
    grid_frequency_hz: 49.75,
    yield_today_kwh: 37.4,
    yield_month_kwh: 1397.5,
    yield_year_kwh: 29414,
    total_yield_kwh: 166213.8,
    daily_on_grid_minutes: 648,
    total_on_grid_hours: 19365,
  },
  last_error: null,
};

type MonitoringSeed = {
  log_date: string;
  generation_kwh: number;
  notes?: string;
};

/** Monthly totals from iSolarCloud Year view (2025). */
const MONTHLY_2025: Record<string, number> = {
  "2025-01": 1457.1,
  "2025-02": 1324.8,
  "2025-03": 1435.2,
  "2025-04": 1509.1,
  "2025-05": 1314.2,
  "2025-06": 1252.4,
  "2025-07": 2841.1,
  "2025-08": 2763.3,
};

const YEAR_2025_TOTAL = 25583.2;

/** Lifetime yearly yields from iSolarCloud. */
const YEARLY_YIELDS: Record<number, number> = {
  2022: 32498.1,
  2023: 42656.3,
  2024: 36062.2,
  2025: 25583.2,
  2026: 29414.0,
};

function monthLog(ym: string, generation_kwh: number, notes: string): MonitoringSeed {
  return {
    log_date: `${ym}-15`,
    generation_kwh: Math.round(generation_kwh * 10) / 10,
    notes,
  };
}

function buildAugust2026DailyLogs(): MonitoringSeed[] {
  const known: Record<string, number> = {
    "2026-08-19": 42,
    "2026-08-20": 44,
    "2026-08-21": 52,
    "2026-08-22": 37.4,
  };
  const monthTotal = 1397.5;
  const knownSum = Object.values(known).reduce((a, b) => a + b, 0);
  const earlyDays = 18;
  const earlyDaily = round1((monthTotal - knownSum) / earlyDays);
  const logs: MonitoringSeed[] = [];

  for (let day = 1; day <= 18; day++) {
    const variation = ((day % 5) - 2) * 1.5;
    logs.push({
      log_date: `2026-08-${String(day).padStart(2, "0")}`,
      generation_kwh: round1(Math.max(earlyDaily + variation, 55)),
      notes: "Estimated from Aug 2026 month total (iSolarCloud)",
    });
  }

  for (const [date, kwh] of Object.entries(known)) {
    logs.push({
      log_date: date,
      generation_kwh: kwh,
      notes:
        date === "2026-08-22"
          ? "Captured from iSolarCloud yield today"
          : "Estimated from daily power curve screenshots",
    });
  }

  return logs;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function build2025MonthlyLogs(): MonitoringSeed[] {
  const knownSum = Object.values(MONTHLY_2025).reduce((a, b) => a + b, 0);
  const remainder = YEAR_2025_TOTAL - knownSum;
  const sepDec = round1(remainder / 4);
  const logs: MonitoringSeed[] = [];

  for (const [ym, kwh] of Object.entries(MONTHLY_2025)) {
    logs.push(monthLog(ym, kwh, "Monthly yield from iSolarCloud Year 2025"));
  }
  for (const month of ["09", "10", "11", "12"]) {
    logs.push(
      monthLog(
        `2025-${month}`,
        sepDec,
        "Estimated Sep–Dec 2025 from annual total",
      ),
    );
  }
  return logs;
}

function build2026JanJulLogs(): MonitoringSeed[] {
  const augTotal = 1397.5;
  const ytd = YEARLY_YIELDS[2026]!;
  const janJulTotal = round1(ytd - augTotal);
  const weights = Object.entries(MONTHLY_2025)
    .filter(([ym]) => ym <= "2025-07")
    .map(([, kwh]) => kwh);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const logs: MonitoringSeed[] = [];
  const months = ["01", "02", "03", "04", "05", "06", "07"];

  months.forEach((month, index) => {
    const share = weights[index]! / weightSum;
    logs.push(
      monthLog(
        `2026-${month}`,
        janJulTotal * share,
        "Estimated Jan–Jul 2026 from YTD minus August capture",
      ),
    );
  });
  return logs;
}

/** Year rollup rows removed — monthly/daily seeds cover trend charts. */

export function buildSungrowMonitoringSeeds(): Array<
  MonitoringSeed & ReturnType<typeof enrichGridTiedLogFields>
> {
  const raw = [
    ...build2025MonthlyLogs(),
    ...build2026JanJulLogs(),
    ...buildAugust2026DailyLogs(),
  ];

  return raw.map((row) => ({
    ...enrichGridTiedLogFields(row.generation_kwh),
    log_date: row.log_date,
    notes: row.notes ?? "Static archive",
  }));
}

export function getSungrowLogForDate(date: string) {
  return buildSungrowMonitoringSeeds().find((row) => row.log_date === date);
}
