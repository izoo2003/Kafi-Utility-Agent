import type { SupabaseClient } from "@supabase/supabase-js";
import type { KitchenInventory } from "@/lib/types/database";
import {
  MAX_CONSUMPTION_CATCH_UP_DAYS,
  addDaysIso,
  daysBetweenIso,
  matchConsumptionProfile,
  roundQty,
  siteTodayIso,
  usageForDate,
} from "@/lib/kitchen/consumption";

export type ConsumptionApplyResult = {
  today: string;
  items_checked: number;
  items_updated: number;
  days_applied: string[];
  updates: Array<{
    id: string;
    item_name: string;
    qty_before: number;
    qty_after: number;
    delta: number;
    applied_on: string;
  }>;
  reorder_levels_set: number;
  skipped_reason?: string;
};

function datesToApply(
  lastApplied: string | null | undefined,
  today: string,
): string[] {
  let start: string;
  if (!lastApplied) {
    // First run: apply today only (do not invent history).
    start = today;
  } else if (lastApplied >= today) {
    return [];
  } else {
    start = addDaysIso(lastApplied, 1);
  }

  const span = daysBetweenIso(start, today);
  if (span < 0) return [];
  const cappedStart =
    span > MAX_CONSUMPTION_CATCH_UP_DAYS
      ? addDaysIso(today, -MAX_CONSUMPTION_CATCH_UP_DAYS + 1)
      : start;

  const out: string[] = [];
  for (let d = cappedStart; d <= today; d = addDaysIso(d, 1)) {
    out.push(d);
  }
  return out;
}

/**
 * Apply estimated daily kitchen consumption for catch-up dates through site today.
 * Idempotent per item via last_auto_decrement_on.
 */
export async function applyDailyKitchenConsumption(
  supabase: SupabaseClient,
  opts?: { today?: string },
): Promise<ConsumptionApplyResult> {
  const today = opts?.today ?? siteTodayIso();
  const { data, error } = await supabase
    .from("kitchen_inventory")
    .select("*")
    .returns<KitchenInventory[]>();

  if (error) throw new Error(error.message);

  const result: ConsumptionApplyResult = {
    today,
    items_checked: data?.length ?? 0,
    items_updated: 0,
    days_applied: [],
    updates: [],
    reorder_levels_set: 0,
  };

  const daysSeen = new Set<string>();

  for (const item of data ?? []) {
    const profile = matchConsumptionProfile(item.item_name);

    // Seed sensible reorder levels when still 0 for consumables.
    if (
      profile &&
      profile.kind !== "none" &&
      profile.suggested_reorder_level > 0 &&
      (item.reorder_level == null || item.reorder_level === 0)
    ) {
      const { error: reorderErr } = await supabase
        .from("kitchen_inventory")
        .update({ reorder_level: profile.suggested_reorder_level })
        .eq("id", item.id);
      if (!reorderErr) {
        item.reorder_level = profile.suggested_reorder_level;
        result.reorder_levels_set += 1;
      }
    }

    if (!profile || profile.kind === "none") {
      // Still stamp last_auto so durables don't re-check forever? Skip stamp.
      continue;
    }

    const days = datesToApply(item.last_auto_decrement_on, today);
    if (days.length === 0) continue;

    let qty = Number(item.current_qty) || 0;
    const qtyStart = qty;
    let totalDelta = 0;

    for (const day of days) {
      const burn = usageForDate(profile, day);
      if (burn <= 0) {
        daysSeen.add(day);
        continue;
      }
      const next = roundQty(Math.max(0, qty - burn));
      const delta = roundQty(next - qty);
      if (delta !== 0) {
        await supabase.from("kitchen_consumption_log").insert({
          kitchen_item_id: item.id,
          applied_on: day,
          qty_before: qty,
          qty_after: next,
          qty_delta: delta,
          reason: "auto_daily",
          notes: profile.note,
        });
        qty = next;
        totalDelta = roundQty(totalDelta + delta);
      }
      daysSeen.add(day);
    }

    const { error: updErr } = await supabase
      .from("kitchen_inventory")
      .update({
        current_qty: qty,
        last_auto_decrement_on: today,
      })
      .eq("id", item.id);

    if (updErr) throw new Error(updErr.message);

    if (totalDelta !== 0 || qty !== qtyStart) {
      result.items_updated += 1;
      result.updates.push({
        id: item.id,
        item_name: item.item_name,
        qty_before: qtyStart,
        qty_after: qty,
        delta: totalDelta,
        applied_on: today,
      });
    } else {
      // Weekends / zero burn — still advance last_auto_decrement_on
      result.items_updated += 1;
    }
  }

  result.days_applied = [...daysSeen].sort();
  return result;
}
