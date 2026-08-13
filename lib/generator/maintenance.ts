/** Monthly checkup cadence for the site generator. */
export const GENERATOR_CHECKUP_INTERVAL_MONTHS = 1;

export type GeneratorCheckupStatus = "done" | "not_done";

export function addCalendarMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDate();
  dt.setUTCMonth(dt.getUTCMonth() + months);
  // Clamp end-of-month overflow (e.g. Jan 31 + 1 month)
  if (dt.getUTCDate() < day) {
    dt.setUTCDate(0);
  }
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function defaultNextServiceDue(serviceDate: string): string {
  return addCalendarMonths(serviceDate, GENERATOR_CHECKUP_INTERVAL_MONTHS);
}

/** Ensure next_service_due defaults to +1 month from service_date. */
export function withDefaultNextServiceDue<
  T extends {
    service_date?: string;
    next_service_due?: string | null;
    service_type?: string | null;
  },
>(payload: T): T {
  if (!payload.service_date) return payload;
  // Explicit value (including empty→already handled by caller) or oil-change (hour-based)
  if (payload.next_service_due) return payload;
  if (
    typeof payload.service_type === "string" &&
    /oil\s*change/i.test(payload.service_type)
  ) {
    return payload;
  }
  return {
    ...payload,
    next_service_due: defaultNextServiceDue(payload.service_date),
  };
}

export function nextDueFromMaintenanceRows(
  rows: {
    service_date: string;
    next_service_due: string | null;
    checkup_status: GeneratorCheckupStatus;
  }[],
): {
  nextDue: string | null;
  lastDoneDate: string | null;
  pendingNotDone: boolean;
} {
  if (!rows.length) {
    return { nextDue: null, lastDoneDate: null, pendingNotDone: false };
  }

  const notDone = rows
    .filter((r) => r.checkup_status === "not_done")
    .map((r) => r.next_service_due ?? r.service_date)
    .filter(Boolean)
    .sort();

  const doneSorted = [...rows]
    .filter((r) => r.checkup_status === "done")
    .sort((a, b) => b.service_date.localeCompare(a.service_date));

  const lastDone = doneSorted[0] ?? null;
  const nextFromDone = lastDone?.next_service_due ?? null;

  return {
    nextDue: notDone[0] ?? nextFromDone,
    lastDoneDate: lastDone?.service_date ?? null,
    pendingNotDone: notDone.length > 0,
  };
}
