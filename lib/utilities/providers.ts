import type { UtilityType } from "@/lib/types/database";

/** Fixed site utility bills (Karachi / Pakistan). */
export const SITE_UTILITY_PROVIDERS = [
  {
    key: "k-electric",
    label: "K-Electric",
    utility_type: "electricity" as const satisfies UtilityType,
    billing_cycle: "monthly",
  },
  {
    key: "ptcl",
    label: "PTCL",
    utility_type: "internet" as const satisfies UtilityType,
    billing_cycle: "monthly",
  },
  {
    key: "ssgc",
    label: "SSGC (Gas)",
    utility_type: "gas" as const satisfies UtilityType,
    billing_cycle: "monthly",
  },
  {
    key: "kwsb",
    label: "KWSB (Water Board)",
    utility_type: "water" as const satisfies UtilityType,
    billing_cycle: "monthly",
  },
  {
    key: "jazz",
    label: "Jazz monthly bill",
    // Stored as internet so it works even before the 'mobile' check is applied.
    utility_type: "internet" as const satisfies UtilityType,
    billing_cycle: "monthly",
  },
] as const;

export type SiteUtilityProviderKey =
  (typeof SITE_UTILITY_PROVIDERS)[number]["key"];

export function providerByKey(key: string) {
  return SITE_UTILITY_PROVIDERS.find((p) => p.key === key) ?? null;
}

export function providerByLabel(label: string | null | undefined) {
  if (!label) return null;
  const t = label.trim().toLowerCase();
  return (
    SITE_UTILITY_PROVIDERS.find(
      (p) =>
        p.label.toLowerCase() === t ||
        p.key === t ||
        p.label.toLowerCase().includes(t),
    ) ?? null
  );
}
