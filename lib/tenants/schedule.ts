export type CalendarPeriod = {
  serial_no: number;
  period_year: number;
  period_month: number;
  period_start: string;
  period_end: string;
};

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

/**
 * Number of monthly ledger rows the given contract dates will produce.
 * Same-day ranges follow the rent-day cycle; everything else counts the
 * calendar months that overlap the range.
 */
export function countCalendarMonths(startIso: string, endIso: string) {
  return ledgerPeriods(startIso, endIso).length;
}

function addMonthsClamped(iso: string, months: number) {
  const { year, month, day } = parseIsoDateParts(iso);
  const total = (year - 1) * 12 + (month - 1) + months;
  const y = Math.floor(total / 12) + 1;
  const m = (total % 12) + 1;
  const last = lastDayOfMonth(y, m);
  return isoDate(y, m, Math.min(day, last));
}

/**
 * Monthly ledger rows for a contract range.
 *
 * When the start and end date share the same rent day (e.g. 26/05 to 26/08,
 * or 26/05 to 25/08), the ledger follows the agreement's day cycle: one row
 * per rent month from the start date, e.g. 26/05–25/06, 26/06–25/07,
 * 26/07–26/08 = 3 rows. Each row is keyed to the month it ends in (the bill
 * month), so a 26/05–25/06 row is the June bill and the May tail days are
 * covered inside it. Any leftover tail days beyond the last full rent month
 * are folded into the final row rather than creating a stray extra row.
 *
 * Any other range keeps the old behaviour: one row per calendar month that
 * overlaps the range.
 */
export function ledgerPeriods(
  startIso: string,
  endIso: string,
): CalendarPeriod[] {
  if (!startIso || !endIso || endIso < startIso) return [];
  const start = parseIsoDateParts(startIso);
  const end = parseIsoDateParts(endIso);
  const sameRentDay =
    end.day === start.day || (start.day > 1 && end.day === start.day - 1);
  if (!sameRentDay) return calendarMonthsOverlapping(startIso, endIso);

  const spans: { start: string; end: string }[] = [];
  let cursor = startIso;
  while (cursor <= endIso) {
    const nextCursor = addMonthsClamped(cursor, 1);
    const fullEnd = addDaysIso(nextCursor, -1);
    if (fullEnd > endIso) {
      if (spans.length > 0) {
        spans[spans.length - 1]!.end = endIso;
      } else {
        spans.push({ start: cursor, end: endIso });
      }
      break;
    }
    spans.push({ start: cursor, end: fullEnd });
    cursor = nextCursor;
  }

  return spans.map((span, index) => {
    const endParts = parseIsoDateParts(span.end);
    return {
      serial_no: index + 1,
      period_year: endParts.year,
      period_month: endParts.month,
      period_start: span.start,
      period_end: span.end,
    };
  });
}

/** One row per calendar month that overlaps [start, end] inclusive. */
export function calendarMonthsOverlapping(
  startIso: string,
  endIso: string,
): CalendarPeriod[] {
  if (!startIso || !endIso || endIso < startIso) return [];
  const start = parseIsoDateParts(startIso);
  const end = parseIsoDateParts(endIso);
  const rows: CalendarPeriod[] = [];
  let year = start.year;
  let month = start.month;
  let serial = 1;
  while (year < end.year || (year === end.year && month <= end.month)) {
    const monthStart = isoDate(year, month, 1);
    const monthEnd = isoDate(year, month, lastDayOfMonth(year, month));
    const periodStart = startIso > monthStart ? startIso : monthStart;
    const periodEnd = endIso < monthEnd ? endIso : monthEnd;
    rows.push({
      serial_no: serial,
      period_year: year,
      period_month: month,
      period_start: periodStart,
      period_end: periodEnd,
    });
    serial += 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return rows;
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
