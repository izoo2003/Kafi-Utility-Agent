/** Oil change after this many generator run-hours (outage sessions summed). */
export const OIL_CHANGE_INTERVAL_HOURS = 200;

export function isOilChangeService(serviceType: string | null | undefined) {
  if (!serviceType) return false;
  return /oil\s*change|oil\s*service|change\s*oil/i.test(serviceType);
}

export function lastOilChangeRecord<
  T extends {
    service_type: string | null;
    service_date: string;
    hour_meter?: number | null;
  },
>(maintenance: T[]): T | null {
  const oil = maintenance
    .filter((r) => isOilChangeService(r.service_type))
    .sort((a, b) => b.service_date.localeCompare(a.service_date));
  return oil[0] ?? null;
}

/** Hours between two local/ISO datetimes (fractional, 2 decimals). */
export function hoursBetween(
  startedAt: string,
  endedAt: string,
): number | null {
  const a = new Date(startedAt).getTime();
  const b = new Date(endedAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.round(((b - a) / 3_600_000) * 100) / 100;
}

/**
 * Sum outage/run hours since last oil change.
 * Runs on the oil-change date itself are excluded (assumed before/at service).
 * Not real-time — only logged sessions count.
 */
export function hoursRunSinceOilChange(
  runs: Array<{ run_date: string; hours_run: number | null }>,
  lastOilServiceDate: string | null | undefined,
): number {
  let sum = 0;
  for (const run of runs) {
    const h = Number(run.hours_run);
    if (!Number.isFinite(h) || h <= 0) continue;
    if (lastOilServiceDate && run.run_date <= lastOilServiceDate) continue;
    sum += h;
  }
  return Math.round(sum * 100) / 100;
}

export function oilChangeStatus(hoursSince: number | null): {
  due: boolean;
  remaining: number | null;
} {
  if (hoursSince == null) return { due: false, remaining: null };
  const remaining = OIL_CHANGE_INTERVAL_HOURS - hoursSince;
  return {
    due: hoursSince >= OIL_CHANGE_INTERVAL_HOURS,
    remaining: remaining > 0 ? Math.round(remaining * 100) / 100 : 0,
  };
}
