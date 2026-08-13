import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KitchenInventory,
  KitchenInventoryInsert,
  KitchenInventoryUpdate,
} from "@/lib/types/database";
import {
  incomingShouldOverwrite,
  normalizeKeyPart,
} from "@/lib/dashboard/dedupe";
import { writeErr, writeOk, type DomainWriteResult } from "@/lib/supabase/write-result";

const TABLE = "kitchen_inventory" as const;

export function kitchenInventoryStatus(
  item: Pick<KitchenInventory, "current_qty" | "reorder_level">,
): "low" | "ok" {
  return item.current_qty <= item.reorder_level ? "low" : "ok";
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

export async function deleteKitchenInventoryItem(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(TABLE).delete().eq("id", id);
}
