import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KitchenConsumptionLog,
  KitchenInventory,
} from "@/lib/types/database";
import { roundQty, siteTodayIso } from "@/lib/kitchen/consumption";
import {
  getKitchenInventoryItem,
  updateKitchenInventoryItem,
} from "@/lib/supabase/kitchen-inventory";

export type StockDirection = "in" | "out";

export type RecordStockMovementInput = {
  direction: StockDirection;
  qty: number;
  applied_on?: string;
  notes?: string | null;
  reason?: string;
};

function stockFromInOut(qtyIn: number, qtyOut: number) {
  return roundQty(Math.max(0, qtyIn - qtyOut));
}

/**
 * Record stock In (received) or Out (finished/consumed).
 * Maintains: current_qty = qty_in - qty_out.
 */
export async function recordKitchenStockMovement(
  supabase: SupabaseClient,
  id: string,
  input: RecordStockMovementInput,
) {
  const qty = roundQty(Number(input.qty));
  if (!(qty > 0)) {
    return {
      data: null,
      error: { message: "Quantity must be greater than zero" } as {
        message: string;
      },
    };
  }

  const existing = await getKitchenInventoryItem(supabase, id);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return {
      data: null,
      error: { message: "Kitchen item not found" } as { message: string },
    };
  }

  const item = existing.data as KitchenInventory;
  const before = roundQty(Number(item.current_qty) || 0);
  let qtyIn = roundQty(Number(item.qty_in) || 0);
  let qtyOut = roundQty(Number(item.qty_out) || 0);

  // Heal rows that predate In/Out columns or drifted stock.
  if (qtyIn === 0 && qtyOut === 0 && before > 0) {
    qtyIn = before;
  }

  const appliedOn = input.applied_on?.trim() || siteTodayIso();
  let reason = input.reason;
  let after: number;

  if (input.direction === "in") {
    qtyIn = roundQty(qtyIn + qty);
    after = stockFromInOut(qtyIn, qtyOut);
    reason = reason ?? "manual_refill";
  } else {
    const take = roundQty(Math.min(qty, before));
    if (take <= 0) {
      return {
        data: null,
        error: { message: "No stock available to take out" } as {
          message: string;
        },
      };
    }
    qtyOut = roundQty(qtyOut + take);
    after = stockFromInOut(qtyIn, qtyOut);
    reason = reason ?? "manual_use";
  }

  const patch: Record<string, unknown> = {
    qty_in: qtyIn,
    qty_out: qtyOut,
    current_qty: after,
  };
  if (input.direction === "in") {
    patch.last_restocked_at = appliedOn;
  }
  if (input.notes) {
    patch.notes = input.notes;
  }

  const updated = await updateKitchenInventoryItem(supabase, id, patch);
  if (updated.error) return updated;

  await supabase.from("kitchen_consumption_log").insert({
    kitchen_item_id: id,
    applied_on: appliedOn,
    qty_before: before,
    qty_after: after,
    qty_delta: roundQty(after - before),
    reason,
    notes: input.notes ?? null,
  });

  return updated;
}

export async function listKitchenConsumptionLog(
  supabase: SupabaseClient,
  opts?: { from?: string; to?: string; limit?: number },
) {
  let q = supabase
    .from("kitchen_consumption_log")
    .select("*")
    .order("applied_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts?.from) q = q.gte("applied_on", opts.from);
  if (opts?.to) q = q.lte("applied_on", opts.to);
  if (opts?.limit) q = q.limit(opts.limit);

  return q.returns<KitchenConsumptionLog[]>();
}
