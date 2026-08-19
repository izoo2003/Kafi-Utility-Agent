import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KitchenInventory,
  KitchenInventoryInsert,
  KitchenInventoryUpdate,
  KitchenInventoryStatus,
} from "@/lib/types/database";
import {
  incomingShouldOverwrite,
  normalizeKeyPart,
} from "@/lib/dashboard/dedupe";
import { assessKitchenStock } from "@/lib/kitchen/consumption";
import { writeErr, writeOk, type DomainWriteResult } from "@/lib/supabase/write-result";

const TABLE = "kitchen_inventory" as const;

export function kitchenInventoryStatus(
  item: Pick<KitchenInventory, "item_name" | "current_qty" | "reorder_level">,
): KitchenInventoryStatus {
  return assessKitchenStock(item).status;
}

export function kitchenInventoryAssessment(
  item: Pick<KitchenInventory, "item_name" | "current_qty" | "reorder_level">,
) {
  return assessKitchenStock(item);
}

export async function listKitchenInventory(supabase: SupabaseClient) {
  return supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .returns<KitchenInventory[]>();
}

export async function getKitchenInventoryItem(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle<KitchenInventory>();
}

async function findKitchenDuplicate(
  supabase: SupabaseClient,
  itemName: string,
): Promise<KitchenInventory | null> {
  const key = normalizeKeyPart(itemName);
  if (!key) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .ilike("item_name", itemName.trim())
    .returns<KitchenInventory[]>();
  if (error || !data?.length) return null;
  return (
    data.find((r) => normalizeKeyPart(r.item_name) === key) ?? data[0] ?? null
  );
}

export async function createKitchenInventoryItem(
  supabase: SupabaseClient,
  input: KitchenInventoryInsert,
): Promise<DomainWriteResult<KitchenInventory>> {
  const opening = Math.max(0, Number(input.current_qty) || 0);
  const seeded: KitchenInventoryInsert = {
    ...input,
    qty_in: Number(input.qty_in) || opening,
    qty_out: Number(input.qty_out) || 0,
    current_qty: Math.max(
      0,
      (Number(input.qty_in) || opening) - (Number(input.qty_out) || 0),
    ),
  };

  const existing = await findKitchenDuplicate(supabase, seeded.item_name);
  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: seeded.last_restocked_at ?? null,
      existingDate: existing.last_restocked_at,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) {
      return writeOk(existing, "skipped");
    }
    const { data, error } = await supabase
      .from(TABLE)
      .update(seeded)
      .eq("id", existing.id)
      .select("*")
      .single<KitchenInventory>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(seeded)
    .select("*")
    .single<KitchenInventory>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateKitchenInventoryItem(
  supabase: SupabaseClient,
  id: string,
  input: KitchenInventoryUpdate,
) {
  return supabase.from(TABLE).update(input).eq("id", id).select("*").single();
}

export async function adjustKitchenInventoryQty(
  supabase: SupabaseClient,
  id: string,
  delta: number,
  notes?: string | null,
) {
  const { recordKitchenStockMovement } = await import(
    "@/lib/kitchen/stock-movements"
  );
  const amount = Math.abs(Number(delta) || 0);
  if (!(amount > 0)) {
    return {
      data: null,
      error: { message: "Delta must be non-zero" } as { message: string },
    };
  }
  return recordKitchenStockMovement(supabase, id, {
    direction: delta > 0 ? "in" : "out",
    qty: amount,
    notes,
  });
}

export async function deleteKitchenInventoryItem(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(TABLE).delete().eq("id", id);
}
