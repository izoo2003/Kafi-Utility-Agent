import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ItEquipment,
  ItEquipmentInsert,
  ItEquipmentUpdate,
} from "@/lib/types/database";

const TABLE = "it_equipment" as const;

export async function listItEquipment(supabase: SupabaseClient) {
  return supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .returns<ItEquipment[]>();
}

export async function getItEquipment(supabase: SupabaseClient, id: string) {
  return supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle()
    .returns<ItEquipment>();
}

export async function createItEquipment(
  supabase: SupabaseClient,
  input: ItEquipmentInsert,
) {
  return supabase.from(TABLE).insert(input).select("*").single();
}

export async function updateItEquipment(
  supabase: SupabaseClient,
  id: string,
  input: ItEquipmentUpdate,
) {
  return supabase.from(TABLE).update(input).eq("id", id).select("*").single();
}

export async function deleteItEquipment(supabase: SupabaseClient, id: string) {
  return supabase.from(TABLE).delete().eq("id", id);
}
