import type { UtilityType } from "@/lib/types/database";

export type SiteUtilityProvider = {
  key: string;
  label: string;
  /** Short heading for multi-site groups (K-Electric). */
  siteLabel?: string;
  utility_type: UtilityType;
  billing_cycle: string;
  /** Menu group — K-Electric sites share "k-electric". */
  menuKey: string;
};

/** Four K-Electric meters / locations — each has its own bill history. */
export const K_ELECTRIC_SITES: readonly SiteUtilityProvider[] = [
  {
    key: "ke-239g-mill",
    label: "K-Electric — SURWAY NO 239G Mill",
    siteLabel: "SURWAY NO 239G Mill",
    utility_type: "electricity",
    billing_cycle: "monthly",
    menuKey: "k-electric",
  },
  {
    key: "ke-234g-mill",
    label: "K-Electric — SURWAY NO 234G Mill",
    siteLabel: "SURWAY NO 234G Mill",
    utility_type: "electricity",
    billing_cycle: "monthly",
    menuKey: "k-electric",
  },
  {
    key: "ke-clifton-office",
    label: "K-Electric — Clifton Office",
    siteLabel: "Clifton Office",
    utility_type: "electricity",
    billing_cycle: "monthly",
    menuKey: "k-electric",
  },
  {
    key: "ke-kmp-house",
    label: "K-Electric — KMP House",
    siteLabel: "KMP House",
    utility_type: "electricity",
    billing_cycle: "monthly",
    menuKey: "k-electric",
  },
] as const;

const OTHER_PROVIDERS: readonly SiteUtilityProvider[] = [
  {
    key: "ssgc-clifton-office",
    label: "SSGC (Gas) — Clifton Office",
    siteLabel: "Clifton Office",
    utility_type: "gas",
    billing_cycle: "monthly",
    menuKey: "ssgc",
  },
  {
    key: "ssgc-kmp-house",
    label: "SSGC (Gas) — KMP House",
    siteLabel: "KMP House",
    utility_type: "gas",
    billing_cycle: "monthly",
    menuKey: "ssgc",
  },
  {
    key: "kwsb-clifton-office",
    label: "KWSB (Water Board) — Clifton Office",
    siteLabel: "Clifton Office",
    utility_type: "water",
    billing_cycle: "monthly",
    menuKey: "kwsb",
  },
  {
    key: "ptcl-office",
    label: "PTCL — Office",
    siteLabel: "Office",
    utility_type: "internet",
    billing_cycle: "monthly",
    menuKey: "ptcl",
  },
  {
    key: "ptcl-kmp-house",
    label: "PTCL — KMP House",
    siteLabel: "KMP House",
    utility_type: "internet",
    billing_cycle: "monthly",
    menuKey: "ptcl",
  },
  {
    key: "jazz-khalid-paracha",
    label: "Jazz monthly bill — Khalid Paracha",
    siteLabel: "Khalid Paracha",
    // Stored as internet so it works even before the 'mobile' check is applied.
    utility_type: "internet",
    billing_cycle: "monthly",
    menuKey: "jazz",
  },
  {
    key: "jazz-sadia-paracha",
    label: "Jazz monthly bill — Sadia Paracha",
    siteLabel: "Sadia Paracha",
    utility_type: "internet",
    billing_cycle: "monthly",
    menuKey: "jazz",
  },
] as const;

/** All accounts to seed / match (4× K-Electric + other utilities). */
export const SITE_UTILITY_PROVIDERS: readonly SiteUtilityProvider[] = [
  ...K_ELECTRIC_SITES,
  ...OTHER_PROVIDERS,
];

/** Top dropdown options (K-Electric is one menu item covering four sites). */
export const UTILITY_MENU_OPTIONS = [
  { key: "k-electric", label: "K-Electric" },
  { key: "ssgc", label: "SSGC (Gas)" },
  { key: "kwsb", label: "KWSB (Water Board)" },
  { key: "ptcl", label: "PTCL" },
  { key: "jazz", label: "Jazz monthly bill" },
] as const;

export type UtilityMenuKey = (typeof UTILITY_MENU_OPTIONS)[number]["key"];
export type SiteUtilityProviderKey = (typeof SITE_UTILITY_PROVIDERS)[number]["key"];

export function providerByKey(key: string) {
  return SITE_UTILITY_PROVIDERS.find((p) => p.key === key) ?? null;
}

/** True when provider label is one of the current dashboard utility sections. */
export function isActiveSiteUtilityProvider(label: string | null | undefined) {
  if (!label) return false;
  const t = label.trim().toLowerCase();
  return SITE_UTILITY_PROVIDERS.some((p) => p.label.toLowerCase() === t);
}

export function providersForMenu(menuKey: string): SiteUtilityProvider[] {
  return SITE_UTILITY_PROVIDERS.filter((p) => p.menuKey === menuKey);
}

export function providerByLabel(label: string | null | undefined) {
  if (!label) return null;
  const t = label.trim().toLowerCase();

  // Legacy "Personal House" → KMP House
  if (t === "personal house" || t.includes("personal house")) {
    if (t.includes("ssgc") || t.includes("gas")) {
      return providerByKey("ssgc-kmp-house");
    }
    if (t.includes("ptcl")) {
      return providerByKey("ptcl-kmp-house");
    }
    if (t.includes("kwsb") || t.includes("water")) {
      return null;
    }
    return providerByKey("ke-kmp-house");
  }

  const exact = SITE_UTILITY_PROVIDERS.find(
    (p) => p.label.toLowerCase() === t || p.key === t,
  );
  if (exact) return exact;

  // Match by site short name (e.g. "Clifton Office")
  const bySite = SITE_UTILITY_PROVIDERS.find(
    (p) => p.siteLabel && p.siteLabel.toLowerCase() === t,
  );
  if (bySite) return bySite;

  // Legacy bare "PTCL" (pre site split) — ambiguous, do not auto-map.
  if (
    t === "k-electric" ||
    t === "kelectric" ||
    t === "ptcl" ||
    t === "ssgc" ||
    t === "ssgc (gas)" ||
    t === "kwsb" ||
    t === "kwsb (water board)" ||
    t === "jazz" ||
    t === "jazz monthly bill"
  ) {
    return null;
  }

  return (
    SITE_UTILITY_PROVIDERS.find(
      (p) =>
        p.label.toLowerCase() === t ||
        p.label.toLowerCase().includes(t) ||
        (p.siteLabel != null && t.includes(p.siteLabel.toLowerCase())),
    ) ?? null
  );
}
