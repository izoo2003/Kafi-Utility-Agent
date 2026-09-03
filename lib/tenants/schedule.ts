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

export function countCalendarMonths(startIso: string, endIso: string) {
  return calendarMonthsOverlapping(startIso, endIso).length;
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
