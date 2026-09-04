import type { WithholdingTaxSlab } from "@/lib/types/database";

export type TenantClassification = "official" | "unofficial";

export const TENANT_CLASSIFICATIONS = ["official", "unofficial"] as const;

export const TENANT_CLASSIFICATION_LABELS: Record<TenantClassification, string> =
  {
    official: "Official",
    unofficial: "Unofficial",
  };

/** Pick the tightest matching slab for a monthly rent amount (highest min_amount that fits). */
export function matchWithholdingSlab(
  monthlyRent: number,
  slabs: WithholdingTaxSlab[],
): WithholdingTaxSlab | null {
  const amount = Number(monthlyRent);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const matches = slabs
    .filter((slab) => {
      const min = Number(slab.min_amount ?? 0);
      const max =
        slab.max_amount == null ? null : Number(slab.max_amount);
      if (!Number.isFinite(min)) return false;
      if (amount < min) return false;
      if (max != null && Number.isFinite(max) && amount > max) return false;
      return true;
    })
    .sort((a, b) => Number(b.min_amount ?? 0) - Number(a.min_amount ?? 0));
  return matches[0] ?? null;
}

export function computeWithholdingTax(
  monthlyRent: number,
  ratePercent: number | null | undefined,
): number {
  const rent = Number(monthlyRent);
  const rate = Number(ratePercent ?? 0);
  if (!Number.isFinite(rent) || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(((rent * rate) / 100) * 100) / 100;
}

export function withholdingForTenant(input: {
  classification: TenantClassification | string | null | undefined;
  monthlyRent: number;
  slabs: WithholdingTaxSlab[];
}): {
  withholding_tax: number;
  total_due: number;
  rate_percent: number | null;
  slab: WithholdingTaxSlab | null;
} {
  const rent = Math.max(0, Number(input.monthlyRent) || 0);
  if (input.classification !== "official") {
    return {
      withholding_tax: 0,
      total_due: rent,
      rate_percent: null,
      slab: null,
    };
  }
  const slab = matchWithholdingSlab(rent, input.slabs);
  const withholding_tax = computeWithholdingTax(
    rent,
    slab?.rate_percent ?? null,
  );
  return {
    withholding_tax,
    total_due: Math.max(0, Math.round((rent - withholding_tax) * 100) / 100),
    rate_percent: slab?.rate_percent ?? null,
    slab,
  };
}
