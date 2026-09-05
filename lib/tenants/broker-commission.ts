import {
  inclusiveDays,
  ledgerPeriods,
  periodProrateFactor,
} from "@/lib/tenants/schedule";

function money(n: number) {
  return Math.round(n * 100) / 100;
}

export type BrokerOccupancyStay = {
  full_months: number;
  leftover_days: number;
  stay_factor: number;
};

/** Contract From/To → full rent-day months + leftover days / 30. */
export function occupancyStay(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): BrokerOccupancyStay {
  if (!startIso || !endIso || endIso < startIso) {
    return { full_months: 0, leftover_days: 0, stay_factor: 0 };
  }
  const periods = ledgerPeriods(startIso, endIso);
  let full_months = 0;
  let leftover_days = 0;
  let stay_factor = 0;
  for (const period of periods) {
    const factor = periodProrateFactor(period.period_start, period.period_end);
    stay_factor += factor;
    if (factor >= 1) {
      full_months += 1;
    } else {
      leftover_days += inclusiveDays(period.period_start, period.period_end);
    }
  }
  return {
    full_months,
    leftover_days,
    stay_factor: money(stay_factor),
  };
}

export function monthlyRentForBroker(input: {
  sqft: number | null | undefined;
  rate: number | null | undefined;
  fallback_gross?: number | null;
}) {
  const sqft = input.sqft == null ? null : Number(input.sqft);
  const rate = input.rate == null ? null : Number(input.rate);
  if (
    sqft != null &&
    rate != null &&
    Number.isFinite(sqft) &&
    Number.isFinite(rate)
  ) {
    return money(sqft * rate);
  }
  const fallback = Number(input.fallback_gross ?? 0);
  return Number.isFinite(fallback) ? money(fallback) : 0;
}

export type BrokerCommissionBreakdown = BrokerOccupancyStay & {
  monthly_rent: number;
  commission_per_month: number;
  month_commission: number;
  day_commission: number;
  commission_amount: number;
};

/** Commission = (monthly rent / 12) × stay. 15 leftover days = half a month. */
export function computeBrokerCommission(input: {
  monthly_rent: number | null | undefined;
  contract_start_date: string | null | undefined;
  contract_end_date: string | null | undefined;
}): BrokerCommissionBreakdown {
  const monthly_rent = money(Math.max(0, Number(input.monthly_rent) || 0));
  const stay = occupancyStay(
    input.contract_start_date,
    input.contract_end_date,
  );
  const commission_per_month = money(monthly_rent / 12);
  const month_commission = money(commission_per_month * stay.full_months);
  const day_commission = money(
    commission_per_month * (stay.leftover_days / 30),
  );
  return {
    ...stay,
    monthly_rent,
    commission_per_month,
    month_commission,
    day_commission,
    commission_amount: money(commission_per_month * stay.stay_factor),
  };
}

export function stayLabel(stay: BrokerOccupancyStay) {
  const parts: string[] = [];
  if (stay.full_months > 0) {
    parts.push(
      `${stay.full_months} month${stay.full_months === 1 ? "" : "s"}`,
    );
  }
  if (stay.leftover_days > 0) {
    parts.push(
      `${stay.leftover_days} day${stay.leftover_days === 1 ? "" : "s"}`,
    );
  }
  return parts.length ? parts.join(" + ") : "No contract dates";
}

/** Rebuild the edit-dialog breakdown from a saved broker row. */
export function breakdownFromStored(row: {
  monthly_rent: number | null | undefined;
  stay_months: number | null | undefined;
  stay_days: number | null | undefined;
  stay_factor?: number | null;
  commission_amount?: number | null;
}): BrokerCommissionBreakdown {
  const monthly_rent = money(Math.max(0, Number(row.monthly_rent) || 0));
  const full_months = Math.max(0, Number(row.stay_months) || 0);
  const leftover_days = Math.max(0, Number(row.stay_days) || 0);
  const stay_factor = money(
    row.stay_factor != null
      ? Number(row.stay_factor)
      : full_months + leftover_days / 30,
  );
  const commission_per_month = money(monthly_rent / 12);
  return {
    full_months,
    leftover_days,
    stay_factor,
    monthly_rent,
    commission_per_month,
    month_commission: money(commission_per_month * full_months),
    day_commission: money(commission_per_month * (leftover_days / 30)),
    commission_amount: money(
      row.commission_amount != null
        ? Number(row.commission_amount)
        : commission_per_month * stay_factor,
    ),
  };
}
