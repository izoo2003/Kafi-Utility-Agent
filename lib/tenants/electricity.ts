import type { TenantPaymentStatus } from "@/lib/types/database";
import { todayIso } from "@/lib/tenants/payment-status";

/** Calendar-month delta between From and To (e.g. May→July = 2). */
export function billingMonths(
  periodFrom: string | null | undefined,
  periodTo: string | null | undefined,
): number | null {
  if (!periodFrom || !periodTo) return null;
  const fromParts = periodFrom.split("-").map(Number);
  const toParts = periodTo.split("-").map(Number);
  if (fromParts.length < 2 || toParts.length < 2) return null;
  const [fy, fm] = fromParts;
  const [ty, tm] = toParts;
  if (
    fy == null ||
    fm == null ||
    ty == null ||
    tm == null ||
    !Number.isFinite(fy) ||
    !Number.isFinite(fm) ||
    !Number.isFinite(ty) ||
    !Number.isFinite(tm)
  ) {
    return null;
  }
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

export function consumedUnits(
  lastReading: number | null | undefined,
  currentReading: number | null | undefined,
): number | null {
  if (lastReading == null || currentReading == null) return null;
  if (!Number.isFinite(lastReading) || !Number.isFinite(currentReading)) {
    return null;
  }
  return currentReading - lastReading;
}

export function billAmount(
  units: number | null | undefined,
  rate: number | null | undefined,
): number | null {
  if (units == null || rate == null) return null;
  if (!Number.isFinite(units) || !Number.isFinite(rate)) return null;
  // Match spreadsheet: round to nearest rupee when close, keep decimals when rate has them
  const raw = units * rate;
  return Math.round(raw * 100) / 100;
}

export function derivePayment(
  amount: number | null | undefined,
  amountReceived: number | null | undefined,
  periodTo: string | null | undefined,
  today = todayIso(),
): { outstanding_amount: number; payment_status: TenantPaymentStatus } {
  const amt = Number(amount ?? 0);
  const recv = Number(amountReceived ?? 0);
  const safeAmt = Number.isFinite(amt) ? amt : 0;
  const safeRecv = Number.isFinite(recv) ? Math.max(0, recv) : 0;
  const outstanding_amount = Math.max(0, Math.round((safeAmt - safeRecv) * 100) / 100);

  let payment_status: TenantPaymentStatus;
  if (safeRecv <= 0) {
    payment_status = safeAmt <= 0 ? "unpaid" : "unpaid";
  } else if (safeRecv >= safeAmt && safeAmt > 0) {
    payment_status = "paid";
  } else if (safeRecv >= safeAmt && safeAmt <= 0) {
    payment_status = "paid";
  } else {
    payment_status = "partial";
  }

  if (payment_status !== "paid" && periodTo && periodTo < today) {
    payment_status = "overdue";
  }

  return { outstanding_amount, payment_status };
}

export type ElectricBillDeriveInput = {
  period_from?: string | null;
  period_to?: string | null;
  last_reading?: number | null;
  current_reading?: number | null;
  rate_inclusive_govt?: number | null;
  amount_received?: number | null;
  payment_date?: string | null;
  notes?: string | null;
};

export type ElectricBillDerivedFields = {
  period_from: string | null;
  period_to: string | null;
  months: number | null;
  last_reading: number | null;
  current_reading: number | null;
  consumed_units: number | null;
  rate_inclusive_govt: number | null;
  ke_charges_amount: number | null;
  amount_received: number | null;
  payment_date: string | null;
  outstanding_amount: number;
  payment_status: TenantPaymentStatus;
  due_date: string | null;
  notes: string | null;
};

/** Recompute all derived columns from ledger inputs (server authority). */
export function deriveElectricBillFields(
  input: ElectricBillDeriveInput,
  today = todayIso(),
): ElectricBillDerivedFields {
  const period_from = input.period_from ?? null;
  const period_to = input.period_to ?? null;
  const last_reading = input.last_reading ?? null;
  const current_reading = input.current_reading ?? null;
  const rate_inclusive_govt = input.rate_inclusive_govt ?? null;
  const amount_received = input.amount_received ?? null;
  const months = billingMonths(period_from, period_to);
  const units = consumedUnits(last_reading, current_reading);
  const ke_charges_amount = billAmount(units, rate_inclusive_govt);
  const payment = derivePayment(
    ke_charges_amount,
    amount_received,
    period_to,
    today,
  );

  return {
    period_from,
    period_to,
    months,
    last_reading,
    current_reading,
    consumed_units: units,
    rate_inclusive_govt,
    ke_charges_amount,
    amount_received,
    payment_date: input.payment_date ?? null,
    outstanding_amount: payment.outstanding_amount,
    payment_status: payment.payment_status,
    due_date: period_to,
    notes: input.notes ?? null,
  };
}

export function formatBillingPeriod(
  periodFrom: string | null | undefined,
  periodTo: string | null | undefined,
): string {
  if (!periodFrom && !periodTo) return "—";
  if (periodFrom && periodTo) {
    return `${formatDisplayDate(periodFrom)} – ${formatDisplayDate(periodTo)}`;
  }
  return formatDisplayDate(periodFrom ?? periodTo!);
}

function formatDisplayDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function formatMonthsLabel(months: number | null | undefined): string {
  if (months == null || !Number.isFinite(Number(months))) return "—";
  const n = Number(months);
  return `${n} ${n === 1 ? "Month" : "Months"}`;
}
