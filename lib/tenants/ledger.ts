import type {
  Tenant,
  TenantRateType,
  TenantRentLineItem,
  TenantRentPayment,
  TenantRentSchedule,
} from "@/lib/types/database";
import {
  inclusiveDays,
  ledgerPeriods,
  monthLabel,
  periodProrateFactor,
  periodRangeLabel,
} from "@/lib/tenants/schedule";
import { withholdingForTenant } from "@/lib/tenants/withholding-tax";
import type { WithholdingTaxSlab } from "@/lib/types/database";
import { formatDate } from "@/lib/format/datetime";
import { formatMoney } from "@/lib/tenants/payment-status";

export type FrozenLineItem = { label: string; amount: number };

export function computeGrossRent(input: {
  rate_type: TenantRateType;
  sqft: number | null | undefined;
  rate: number | null | undefined;
  gross_rent?: number | null;
}) {
  if (input.rate_type === "lum_sum") {
    return input.gross_rent ?? null;
  }
  if (input.sqft == null || input.rate == null) return input.gross_rent ?? null;
  return Number(input.sqft) * Number(input.rate);
}

export function otherChargesTotal(
  lineItems: Array<{ amount: number | null | undefined }>,
) {
  return lineItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
}

export function monthlyTotal(
  grossRent: number | null | undefined,
  lineItems: Array<{ amount: number | null | undefined }>,
) {
  return Number(grossRent ?? 0) + otherChargesTotal(lineItems);
}

export function prorateMoney(
  amount: number | null | undefined,
  factor: number,
) {
  return Math.round(Number(amount ?? 0) * factor * 100) / 100;
}

/** Snapshot rent, extras, WHT and net due for one ledger period. */
export function amountsForPeriod(input: {
  period_start: string;
  period_end: string;
  gross_rent: number | null | undefined;
  line_items: FrozenLineItem[];
  classification: Tenant["classification"] | string | null | undefined;
  slabs: WithholdingTaxSlab[];
}) {
  const factor = periodProrateFactor(input.period_start, input.period_end);
  const fullMonthly = monthlyTotal(input.gross_rent, input.line_items);
  const wht = withholdingForTenant({
    classification: input.classification,
    monthlyRent: fullMonthly,
    slabs: input.slabs,
  });
  return {
    factor,
    gross_rent: prorateMoney(input.gross_rent, factor),
    line_items: input.line_items.map((item) => ({
      label: item.label,
      amount: prorateMoney(item.amount, factor),
    })),
    withholding_tax: prorateMoney(wht.withholding_tax, factor),
    total_due: prorateMoney(wht.total_due, factor),
  };
}

export function paymentsReceived(payments: TenantRentPayment[]) {
  return payments.reduce((sum, p) => sum + Number(p.amount_received ?? 0), 0);
}

export function scheduleBalance(
  totalDue: number | null | undefined,
  payments: TenantRentPayment[],
) {
  return Number(totalDue ?? 0) - paymentsReceived(payments);
}

export function paymentRefLabel(payments: TenantRentPayment[]) {
  const refs = payments
    .map((p) => p.payment_reference?.trim() || (p.cheque_no ? `CH # ${p.cheque_no}` : ""))
    .filter(Boolean);
  return refs.join("; ") || "—";
}

export type LedgerRow = TenantRentSchedule & {
  payments: TenantRentPayment[];
  received: number;
  balance: number;
  month_label: string;
  frozen_line_items: FrozenLineItem[];
};

export function toLedgerRows(
  schedule: TenantRentSchedule[],
  payments: TenantRentPayment[],
): LedgerRow[] {
  const bySchedule = new Map<string, TenantRentPayment[]>();
  for (const payment of payments) {
    const list = bySchedule.get(payment.schedule_id) ?? [];
    list.push(payment);
    bySchedule.set(payment.schedule_id, list);
  }
  return [...schedule]
    .sort((a, b) => a.serial_no - b.serial_no)
    .map((row) => {
      const rowPayments = bySchedule.get(row.id) ?? [];
      const frozen = Array.isArray(row.line_items)
        ? (row.line_items as FrozenLineItem[])
        : [];
      return {
        ...row,
        payments: rowPayments,
        received: paymentsReceived(rowPayments),
        balance: scheduleBalance(row.total_due, rowPayments),
        month_label: periodRangeLabel(row.period_start, row.period_end),
        frozen_line_items: frozen,
      };
    });
}

export function tenantOutstanding(rows: LedgerRow[]) {
  return rows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0);
}

/** Compact month labels for ledger rows that still have a rent balance. */
export function dueMonthLabels(rows: LedgerRow[]) {
  return rows
    .filter((row) => row.balance > 0)
    .map((row) => monthLabel(row.period_year, row.period_month));
}

export function contractDurationLabel(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  if (!start || !end) return "—";
  const periods = ledgerPeriods(start, end);
  const full = periods.filter(
    (p) => periodProrateFactor(p.period_start, p.period_end) >= 1,
  ).length;
  const stub = periods.find(
    (p) => periodProrateFactor(p.period_start, p.period_end) < 1,
  );
  const months = full > 0 ? full : periods.length;
  const unit = months === 1 ? "MONTH" : "MONTHS";
  const monthBit = `${String(months).padStart(2, "0")} ${unit}`;
  const daysBit = stub
    ? ` + ${inclusiveDays(stub.period_start, stub.period_end)} DAYS`
    : "";
  return `${formatDate(start)} TO ${formatDate(end)} (FOR ${monthBit}${daysBit})`;
}

export function contractDetailLine(
  tenant: Tenant,
  lineItems: TenantRentLineItem[],
  withholdingTax?: number | null,
) {
  if (tenant.contract_detail?.trim()) return tenant.contract_detail.trim();
  const parts: string[] = [];
  if (tenant.survey_no) parts.push(`SURVEY # ${tenant.survey_no}`);
  if (tenant.sqft != null) {
    parts.push(`${Number(tenant.sqft).toLocaleString()} SQFT`);
  }
  if (tenant.rate_type === "lum_sum") {
    parts.push("LUM SUM");
  } else if (tenant.rate != null) {
    parts.push(`@ ${formatMoney(tenant.rate)}`);
  }
  if (tenant.gross_rent != null) {
    parts.push(`= Rs.${formatMoney(tenant.gross_rent)}`);
  }
  for (const item of lineItems) {
    parts.push(`+ ${item.label} ${formatMoney(item.amount)}`);
  }
  const monthly = monthlyTotal(tenant.gross_rent, lineItems);
  parts.push(`TOTAL RS.${formatMoney(monthly)} PER MONTH`);
  if (
    tenant.classification === "official" &&
    withholdingTax != null &&
    withholdingTax > 0
  ) {
    parts.push(`WHT RS.${formatMoney(withholdingTax)}`);
    parts.push(
      `NET RS.${formatMoney(Math.max(0, monthly - withholdingTax))} PER MONTH`,
    );
  }
  return parts.join(" ");
}

export function tenantListStatus(tenant: Tenant, outstanding: number) {
  if (!tenant.contract_end_date) return "No contract dates";
  if (tenant.contract_end_date < new Date().toISOString().slice(0, 10)) {
    return "Expired";
  }
  if (outstanding > 0) return "Balance due";
  return "Current";
}
