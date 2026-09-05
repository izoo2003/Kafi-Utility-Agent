import { formatDate } from "@/lib/format/datetime";

export type CalendarPeriod = {
  serial_no: number;
  period_year: number;
  period_month: number;
  period_start: string;
  period_end: string;
};

/** Commercial month used to prorate leftover days (15 days = half rent). */
export const BILLING_DAYS_PER_MONTH = 30;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function parseIsoDateParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y ?? 0, month: m ?? 0, day: d ?? 0 };
}

export function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDaysIso(iso: string, days: number) {
  const { year, month, day } = parseIsoDateParts(iso);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function inclusiveDays(startIso: string, endIso: string) {
  const start = parseIsoDateParts(startIso);
  const end = parseIsoDateParts(endIso);
  const a = Date.UTC(start.year, start.month - 1, start.day);
  const b = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((b - a) / 86_400_000) + 1;
}

export function addMonthsClamped(iso: string, months: number) {
  const { year, month, day } = parseIsoDateParts(iso);
  const total = (year - 1) * 12 + (month - 1) + months;
  const y = Math.floor(total / 12) + 1;
  const m = (total % 12) + 1;
  const last = lastDayOfMonth(y, m);
  return isoDate(y, m, Math.min(day, last));
}

export function fullRentCycleEnd(startIso: string) {
  return addDaysIso(addMonthsClamped(startIso, 1), -1);
}

/**
 * 1 when the row covers a full rent cycle (or a 1-day anniversary fold).
 * Otherwise days stayed / 30, so 15 days is half a month.
 */
export function periodProrateFactor(startIso: string, endIso: string) {
  if (!startIso || !endIso || endIso < startIso) return 0;
  const fullEnd = fullRentCycleEnd(startIso);
  if (endIso >= fullEnd) return 1;
  return Math.min(1, inclusiveDays(startIso, endIso) / BILLING_DAYS_PER_MONTH);
}

/**
 * Number of ledger rows the given contract dates will produce.
 */
export function countCalendarMonths(startIso: string, endIso: string) {
  return ledgerPeriods(startIso, endIso).length;
}

/**
 * Monthly ledger rows for a contract range.
 *
 * Always follows the agreement's rent-day cycle from the start date
 * (14/04–13/05, 14/05–13/06, …). A leftover tail that is not a full
 * cycle becomes its own row and is later charged by days / 30.
 *
 * The only fold: when the contract ends on the same rent day as it
 * started (14/04–14/08) the extra anniversary day stays on the last
 * full month instead of making a 1-day row.
 */
export function ledgerPeriods(
  startIso: string,
  endIso: string,
): CalendarPeriod[] {
  if (!startIso || !endIso || endIso < startIso) return [];
  const start = parseIsoDateParts(startIso);
  const end = parseIsoDateParts(endIso);
  const anniversaryEnd = end.day === start.day;

  const spans: { start: string; end: string }[] = [];
  let cursor = startIso;
  while (cursor <= endIso) {
    const nextCursor = addMonthsClamped(cursor, 1);
    const fullEnd = addDaysIso(nextCursor, -1);
    if (fullEnd <= endIso) {
      spans.push({ start: cursor, end: fullEnd });
      cursor = nextCursor;
      continue;
    }
    if (spans.length > 0 && anniversaryEnd && cursor === endIso) {
      spans[spans.length - 1]!.end = endIso;
      break;
    }
    spans.push({ start: cursor, end: endIso });
    break;
  }

  return spans.map((span, index) => {
    const startParts = parseIsoDateParts(span.start);
    return {
      serial_no: index + 1,
      period_year: startParts.year,
      period_month: startParts.month,
      period_start: span.start,
      period_end: span.end,
    };
  });
}

/** @deprecated Prefer ledgerPeriods; kept for callers that still import it. */
export function calendarMonthsOverlapping(
  startIso: string,
  endIso: string,
): CalendarPeriod[] {
  return ledgerPeriods(startIso, endIso);
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function monthLabel(year: number, month: number) {
  const name = MONTH_SHORT[month - 1] ?? pad2(month);
  return `${name}-${String(year).slice(-2)}`;
}

export function periodRangeLabel(startIso: string, endIso: string) {
  const range = `${formatDate(startIso)} – ${formatDate(endIso)}`;
  const factor = periodProrateFactor(startIso, endIso);
  if (factor >= 1) return range;
  const days = inclusiveDays(startIso, endIso);
  return `${range} (${days} day${days === 1 ? "" : "s"})`;
}
