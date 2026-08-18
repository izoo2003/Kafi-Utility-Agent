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
    .maybeSingle()
    .returns<KitchenInventory>();
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
  const existing = await findKitchenDuplicate(supabase, input.item_name);
  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: input.last_restocked_at ?? null,
      existingDate: existing.last_restocked_at,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) {
      return writeOk(existing, "skipped");
    }
    const { data, error } = await supabase
      .from(TABLE)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<KitchenInventory>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
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
  const existing = await getKitchenInventoryItem(supabase, id);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return {
      data: null,
      error: { message: "Kitchen item not found" } as { message: string },
    };
  }
  const item = existing.data;
  const before = Number(item.current_qty) || 0;
  const after = Math.round(Math.max(0, before + delta) * 1000) / 1000;
  const patch: KitchenInventoryUpdate = {
    current_qty: after,
  };
  if (delta > 0) {
    patch.last_restocked_at = new Date().toISOString().slice(0, 10);
  }
  if (notes) {
    patch.notes = notes;
  }
  const updated = await updateKitchenInventoryItem(supabase, id, patch);
  if (updated.error) return updated;

  await supabase.from("kitchen_consumption_log").insert({
    kitchen_item_id: id,
    applied_on: new Date().toISOString().slice(0, 10),
    qty_before: before,
    qty_after: after,
    qty_delta: Math.round((after - before) * 1000) / 1000,
    reason: delta >= 0 ? "manual_refill" : "manual_use",
    notes: notes ?? null,
  });

  return updated;
}

export async function deleteKitchenInventoryItem(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(TABLE).delete().eq("id", id);
}
