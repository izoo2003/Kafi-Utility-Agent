import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KitchenInventory,
  KitchenInventoryInsert,
  KitchenInventoryUpdate,
} from "@/lib/types/database";

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
    .order("item_name", { ascending: true })
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

export async function createKitchenInventoryItem(
  supabase: SupabaseClient,
  input: KitchenInventoryInsert,
) {
  return supabase.from(TABLE).insert(input).select("*").single();
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
