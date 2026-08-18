/**
 * Office kitchen consumption estimates for automated daily decrements.
 * Branch headcount assumption: ~20 staff on site regularly.
 */

export const OFFICE_STAFF_ON_SITE = 20;
export const CUPS_TEA_PER_PERSON_PER_DAY = 2;
/** Estimate of on-site staff who prefer green tea over black. */
export const GREEN_TEA_DRINKERS = 4;
/** Warn when projected empty within this many working/calendar days. */
export const PROJECTED_EMPTY_WARN_DAYS = 7;
/** Critical when projected empty within this many days (still before zero). */
export const PROJECTED_EMPTY_CRITICAL_DAYS = 3;
/** Max days to catch up if cron missed runs. */
export const MAX_CONSUMPTION_CATCH_UP_DAYS = 14;

export type ConsumptionKind = "weekday" | "daily" | "none";

export type ConsumptionProfile = {
  /** Match against normalized item_name (substring). */
  match: string;
  kind: ConsumptionKind;
  /** Units consumed per application day (same unit as inventory row). */
  daily_usage: number;
  /** Suggested reorder_level when currently 0. */
  suggested_reorder_level: number;
  note: string;
};

const BLACK_CUPS =
  (OFFICE_STAFF_ON_SITE - GREEN_TEA_DRINKERS) * CUPS_TEA_PER_PERSON_PER_DAY;
const GREEN_CUPS = GREEN_TEA_DRINKERS * CUPS_TEA_PER_PERSON_PER_DAY;
const TOTAL_CUPS = OFFICE_STAFF_ON_SITE * CUPS_TEA_PER_PERSON_PER_DAY;

/** ~2g tea leaf per cup; Black Tea stored as 450g packs. */
const BLACK_TEA_G_PER_PACK = 450;
const BLACK_TEA_G_PER_CUP = 2;
/** Green Tea stored as ~90 bag packs. */
const GREEN_TEA_BAGS_PER_PACK = 90;
/** ~5g sugar per cup. */
const SUGAR_KG_PER_CUP = 0.005;
/** ~40ml milk per cup; Olpers carton = 32 × 1.5L bottles. */
const MILK_L_PER_CUP = 0.04;
const MILK_L_PER_BOTTLE = 1.5;
const MILK_BOTTLES_PER_CARTON = 32;

/**
 * Ordered specific → general. First match wins.
 * Durable crockery/appliances use kind "none" (tracked, no auto-burn).
 */
export const CONSUMPTION_PROFILES: readonly ConsumptionProfile[] = [
  {
    match: "black tea",
    kind: "weekday",
    daily_usage: (BLACK_CUPS * BLACK_TEA_G_PER_CUP) / BLACK_TEA_G_PER_PACK,
    suggested_reorder_level: 1,
    note: `${BLACK_CUPS} black tea cups/weekday ≈ ${((BLACK_CUPS * BLACK_TEA_G_PER_CUP) / BLACK_TEA_G_PER_PACK).toFixed(3)} pack/day (450g)`,
  },
  {
    match: "green tea",
    kind: "weekday",
    daily_usage: GREEN_CUPS / GREEN_TEA_BAGS_PER_PACK,
    suggested_reorder_level: 1,
    note: `${GREEN_CUPS} green tea bags/weekday ≈ ${(GREEN_CUPS / GREEN_TEA_BAGS_PER_PACK).toFixed(3)} pack/day (90pcs)`,
  },
  {
    match: "sugar",
    kind: "weekday",
    daily_usage: TOTAL_CUPS * SUGAR_KG_PER_CUP,
    suggested_reorder_level: 2,
    note: `${TOTAL_CUPS} cups × 5g sugar ≈ ${(TOTAL_CUPS * SUGAR_KG_PER_CUP).toFixed(2)} kg/weekday`,
  },
  {
    match: "olpers milk",
    kind: "weekday",
    daily_usage:
      (TOTAL_CUPS * MILK_L_PER_CUP) /
      (MILK_L_PER_BOTTLE * MILK_BOTTLES_PER_CARTON),
    suggested_reorder_level: 1,
    note: `${TOTAL_CUPS} cups × 40ml milk ≈ ${((TOTAL_CUPS * MILK_L_PER_CUP) / (MILK_L_PER_BOTTLE * MILK_BOTTLES_PER_CARTON)).toFixed(3)} carton/weekday`,
  },
  {
    match: "hand wash lux",
    kind: "weekday",
    daily_usage: 1 / 30,
    suggested_reorder_level: 1,
    note: "~1 bottle / 30 office days",
  },
  {
    match: "handwash palmolive",
    kind: "weekday",
    daily_usage: 1 / 30,
    suggested_reorder_level: 1,
    note: "~1 bottle / 30 office days",
  },
  {
    match: "hand wash",
    kind: "weekday",
    daily_usage: 1 / 30,
    suggested_reorder_level: 1,
    note: "~1 bottle / 30 office days",
  },
  {
    match: "harpic",
    kind: "daily",
    daily_usage: 1 / 45,
    suggested_reorder_level: 1,
    note: "~1 bottle / 45 days",
  },
  {
    match: "d.w lemon",
    kind: "weekday",
    daily_usage: 1 / 30,
    suggested_reorder_level: 1,
    note: "Dish soap bar ~1 / 30 office days",
  },
  {
    match: "foam sponge",
    kind: "weekday",
    daily_usage: 1 / 21,
    suggested_reorder_level: 1,
    note: "~1 sponge / 21 office days",
  },
  {
    match: "glass cleaner",
    kind: "daily",
    daily_usage: 1 / 60,
    suggested_reorder_level: 1,
    note: "~1 bottle / 60 days",
  },
  {
    match: "dettol",
    kind: "daily",
    daily_usage: 1 / 60,
    suggested_reorder_level: 1,
    note: "~1 bottle / 60 days",
  },
  {
    match: "acid",
    kind: "daily",
    daily_usage: 1 / 90,
    suggested_reorder_level: 1,
    note: "~1 unit / 90 days",
  },
  {
    match: "mop",
    kind: "daily",
    daily_usage: 1 / 180,
    suggested_reorder_level: 1,
    note: "Wear item ~1 / 180 days",
  },
  {
    match: "jelly",
    kind: "none",
    daily_usage: 0,
    suggested_reorder_level: 0,
    note: "Company product / export leftovers — no auto decrement",
  },
  // Durables — track only
  {
    match: "dust pan",
    kind: "none",
    daily_usage: 0,
    suggested_reorder_level: 0,
    note: "Durable — no auto decrement",
  },
  {
    match: "guest tea set",
    kind: "none",
    daily_usage: 0,
    suggested_reorder_level: 0,
    note: "Durable — no auto decrement",
  },
  {
    match: "tea cups",
    kind: "none",
    daily_usage: 0,
    suggested_reorder_level: 0,
    note: "Durable — no auto decrement",
  },
  {
    match: "water glass",
    kind: "none",
    daily_usage: 0,
    suggested_reorder_level: 0,
    note: "Durable — no auto decrement",
  },
  {
    match: "staff water bottle",
    kind: "none",
    daily_usage: 0,
    suggested_reorder_level: 0,
    note: "Durable — no auto decrement",
  },
  {
    match: "oven",
    kind: "none",
    daily_usage: 0,
    suggested_reorder_level: 0,
    note: "Appliance — no auto decrement",
  },
  {
    match: "spoon",
    kind: "none",
    daily_usage: 0,
    suggested_reorder_level: 0,
    note: "Durable — no auto decrement",
  },
] as const;

export function normalizeItemName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchConsumptionProfile(
  itemName: string,
): ConsumptionProfile | null {
  const n = normalizeItemName(itemName);
  for (const p of CONSUMPTION_PROFILES) {
    if (n.includes(p.match)) return p;
  }
  return null;
}

/** Site calendar date YYYY-MM-DD in Asia/Karachi. */
export function siteTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Mon–Fri in Asia/Karachi. */
export function isSiteWeekday(isoDate: string): boolean {
  const [y, m, d] = isoDate.split("-").map(Number);
  // Noon UTC avoids DST edge cases; Karachi has no DST.
  const weekday = new Date(Date.UTC(y, m - 1, d, 7, 0, 0)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysBetweenIso(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function usageForDate(
  profile: ConsumptionProfile,
  isoDate: string,
): number {
  if (profile.kind === "none" || profile.daily_usage <= 0) return 0;
  if (profile.kind === "weekday" && !isSiteWeekday(isoDate)) return 0;
  return profile.daily_usage;
}

/** Approximate days until empty at current burn (ignores weekends for weekday items). */
export function estimateDaysRemaining(
  qty: number,
  profile: ConsumptionProfile | null,
): number | null {
  if (!profile || profile.kind === "none" || profile.daily_usage <= 0) {
    return null;
  }
  if (qty <= 0) return 0;
  if (profile.kind === "weekday") {
    // Convert stock to weekday-days, then inflate to calendar days (~5/7).
    const weekdayDays = qty / profile.daily_usage;
    return Math.floor(weekdayDays * (7 / 5));
  }
  return Math.floor(qty / profile.daily_usage);
}

export type KitchenStockLevel = "out" | "low" | "watch" | "ok";

export function assessKitchenStock(item: {
  item_name: string;
  current_qty: number;
  reorder_level: number;
}): {
  status: KitchenStockLevel;
  daily_usage: number | null;
  days_remaining: number | null;
  profile: ConsumptionProfile | null;
  consumable: boolean;
} {
  const profile = matchConsumptionProfile(item.item_name);
  const daily =
    profile && profile.kind !== "none" ? profile.daily_usage : null;
  const days = estimateDaysRemaining(item.current_qty, profile);
  const consumable = Boolean(profile && profile.kind !== "none");

  if (item.current_qty <= 0) {
    return {
      status: "out",
      daily_usage: daily,
      days_remaining: 0,
      profile,
      consumable,
    };
  }
  if (item.current_qty <= item.reorder_level) {
    return {
      status: "low",
      daily_usage: daily,
      days_remaining: days,
      profile,
      consumable,
    };
  }
  if (
    days != null &&
    days <= PROJECTED_EMPTY_WARN_DAYS
  ) {
    return {
      status: "watch",
      daily_usage: daily,
      days_remaining: days,
      profile,
      consumable,
    };
  }
  return {
    status: "ok",
    daily_usage: daily,
    days_remaining: days,
    profile,
    consumable,
  };
}

export function roundQty(n: number) {
  return Math.round(n * 1000) / 1000;
}
