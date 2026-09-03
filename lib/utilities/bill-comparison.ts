import type { UtilityPaymentLog } from "@/lib/types/database";
import { latestPayment } from "@/lib/utilities/billing";

export type BillSnapshot = {
  id: string;
  paid_on: string;
  amount: number | null;
  units: number | null;
  bill_period: string | null;
  invoice_number: string | null;
  notes: string | null;
  has_bill_file: boolean;
};

export type BillComparison = {
  current: BillSnapshot | null;
  previous: BillSnapshot | null;
  amount_delta: number | null;
  amount_pct: number | null;
  units_delta: number | null;
  units_pct: number | null;
  recent: BillSnapshot[];
};

function snapshot(row: UtilityPaymentLog): BillSnapshot {
  return {
    id: row.id,
    paid_on: row.paid_on,
    amount: row.amount == null ? null : Number(row.amount),
    units: row.units_kwh == null ? null : Number(row.units_kwh),
    bill_period: row.bill_period,
    invoice_number: row.invoice_number,
    notes: row.notes,
    has_bill_file: Boolean(row.bill_file_url),
  };
}

function pctChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function delta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return current - previous;
}

/** Newest-first payments for one account → this bill vs previous + recent history. */
export function buildBillComparison(
  payments: UtilityPaymentLog[],
): BillComparison {
  const sorted = [...payments].sort((a, b) => {
    const byDate = b.paid_on.localeCompare(a.paid_on);
    if (byDate !== 0) return byDate;
    return b.created_at.localeCompare(a.created_at);
  });
  const currentRow = latestPayment(sorted);
  const previousRow = currentRow
    ? sorted.find((row) => row.id !== currentRow.id) ?? null
    : null;
  const current = currentRow ? snapshot(currentRow) : null;
  const previous = previousRow ? snapshot(previousRow) : null;

  return {
    current,
    previous,
    amount_delta: delta(current?.amount ?? null, previous?.amount ?? null),
    amount_pct: pctChange(current?.amount ?? null, previous?.amount ?? null),
    units_delta: delta(current?.units ?? null, previous?.units ?? null),
    units_pct: pctChange(current?.units ?? null, previous?.units ?? null),
    recent: sorted.slice(0, 6).map(snapshot),
  };
}

export function formatSigned(n: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

export function formatPct(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n).toFixed(1);
  if (n > 0) return `+${abs}%`;
  if (n < 0) return `−${abs}%`;
  return "0%";
}
