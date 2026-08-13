import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ItEquipment,
  ItEquipmentInsert,
  ItEquipmentUpdate,
} from "@/lib/types/database";
import {
  incomingShouldOverwrite,
  normalizeKeyPart,
} from "@/lib/dashboard/dedupe";
import { writeErr, writeOk, type DomainWriteResult } from "@/lib/supabase/write-result";

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

async function findItDuplicate(
  supabase: SupabaseClient,
  assetTag: string,
): Promise<ItEquipment | null> {
  const key = normalizeKeyPart(assetTag);
  if (!key) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .ilike("asset_tag", assetTag.trim())
    .returns<ItEquipment[]>();
  if (error || !data?.length) return null;
  return (
    data.find((r) => normalizeKeyPart(r.asset_tag) === key) ?? data[0] ?? null
  );
}

export async function createItEquipment(
  supabase: SupabaseClient,
  input: ItEquipmentInsert,
): Promise<DomainWriteResult<ItEquipment>> {
  const existing = await findItDuplicate(supabase, input.asset_tag);
  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: input.purchase_date ?? input.warranty_expiry ?? null,
      existingDate: existing.purchase_date ?? existing.warranty_expiry,
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
      .single<ItEquipment>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select("*")
    .single<ItEquipment>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
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
