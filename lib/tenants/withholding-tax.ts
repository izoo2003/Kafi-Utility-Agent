export type TenantClassification = "official" | "unofficial";

export const TENANT_CLASSIFICATIONS = ["official", "unofficial"] as const;

export const TENANT_CLASSIFICATION_LABELS: Record<TenantClassification, string> =
  {
    official: "Official",
    unofficial: "Unofficial",
  };

export type WithholdingSlabBand = {
  label: string;
  min_amount: number;
  max_amount: number | null;
  rate_percent: number;
  notes: string;
};

/** Pakistan tax on rent 2026-27 — Filer only. Amounts are yearly rent. */
export const FILER_RENT_SLABS_2026_27: WithholdingSlabBand[] = [
  {
    label: "Up to Rs. 300,000",
    min_amount: 0,
    max_amount: 300_000,
    rate_percent: 0,
    notes: "No tax. First Rs. 300,000 of yearly rent is tax-free.",
  },
  {
    label: "Rs. 300,001 – 600,000",
    min_amount: 300_000,
    max_amount: 600_000,
    rate_percent: 5,
    notes: "5% of the yearly rent above Rs. 300,000.",
  },
  {
    label: "Rs. 600,001 – 2,000,000",
    min_amount: 600_000,
    max_amount: 2_000_000,
    rate_percent: 10,
    notes: "Rs. 15,000 + 10% of the yearly rent above Rs. 600,000.",
  },
  {
    label: "Above Rs. 2,000,000",
    min_amount: 2_000_000,
    max_amount: null,
    rate_percent: 25,
    notes: "Rs. 155,000 + 25% of the yearly rent above Rs. 2,000,000.",
  },
];

type SlabLike = Pick<
  WithholdingTaxSlab,
  "min_amount" | "max_amount" | "rate_percent"
>;

function money(n: number) {
  return Math.round(n * 100) / 100;
}

/** Progressive yearly tax: each band taxes only the rent inside that bracket. */
export function computeProgressiveYearlyTax(
  yearlyRent: number,
  slabs: SlabLike[],
) {
  const yearly = Math.max(0, Number(yearlyRent) || 0);
  if (!slabs.length) return 0;
  const sorted = [...slabs].sort(
    (a, b) => Number(a.min_amount ?? 0) - Number(b.min_amount ?? 0),
  );
  let tax = 0;
  for (const slab of sorted) {
    const from = Number(slab.min_amount ?? 0);
    const to =
      slab.max_amount == null
        ? Number.POSITIVE_INFINITY
        : Number(slab.max_amount);
    const rate = Number(slab.rate_percent ?? 0);
    const slice = Math.max(0, Math.min(yearly, to) - from);
    if (slice > 0 && Number.isFinite(rate) && rate > 0) {
      tax += (slice * rate) / 100;
    }
  }
  return money(tax);
}

export function computeMonthlyWithholdingTax(
  monthlyRent: number,
  slabs: SlabLike[],
) {
  const monthly = Math.max(0, Number(monthlyRent) || 0);
  const yearlyTax = computeProgressiveYearlyTax(monthly * 12, slabs);
  return money(yearlyTax / 12);
}

/** Highest yearly band that the annualized monthly rent falls into. */
export function matchWithholdingSlab<T extends SlabLike>(
  monthlyRent: number,
  slabs: T[],
): T | null {
  const yearly = Math.max(0, Number(monthlyRent) || 0) * 12;
  if (!Number.isFinite(yearly)) return null;
  const matches = slabs
    .filter((slab) => {
      const min = Number(slab.min_amount ?? 0);
      const max =
        slab.max_amount == null ? null : Number(slab.max_amount);
      if (!Number.isFinite(min)) return false;
      // Bands are stored as [from, to] for slice math; a value sitting
      // exactly on `from` belongs to the previous band.
      if (min > 0 && yearly <= min) return false;
      if (yearly < min) return false;
      if (max != null && Number.isFinite(max) && yearly > max) return false;
      return true;
    })
    .sort((a, b) => Number(b.min_amount ?? 0) - Number(a.min_amount ?? 0));
  return matches[0] ?? null;
}

export function computeWithholdingTax(
  monthlyRent: number,
  slabs: SlabLike[],
) {
  return computeMonthlyWithholdingTax(monthlyRent, slabs);
}

export function withholdingForTenant(input: {
  classification: TenantClassification | string | null | undefined;
  monthlyRent: number;
  slabs: SlabLike[];
}): {
  withholding_tax: number;
  total_due: number;
  yearly_rent: number;
  yearly_tax: number;
  rate_percent: number | null;
  slab: SlabLike | null;
} {
  const rent = Math.max(0, Number(input.monthlyRent) || 0);
  const yearly_rent = money(rent * 12);
  if (input.classification !== "official") {
    return {
      withholding_tax: 0,
      total_due: rent,
      yearly_rent,
      yearly_tax: 0,
      rate_percent: null,
      slab: null,
    };
  }
  const yearly_tax = computeProgressiveYearlyTax(yearly_rent, input.slabs);
  const withholding_tax = money(yearly_tax / 12);
  const slab = matchWithholdingSlab(rent, input.slabs);
  return {
    withholding_tax,
    total_due: money(Math.max(0, rent - withholding_tax)),
    yearly_rent,
    yearly_tax,
    rate_percent: slab ? Number(slab.rate_percent) : null,
    slab,
  };
}
