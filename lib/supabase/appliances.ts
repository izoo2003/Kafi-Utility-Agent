import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Appliance,
  ApplianceInsert,
  ApplianceSite,
  ApplianceUpdate,
} from "@/lib/types/database";
import {
  incomingShouldOverwrite,
  normalizeKeyPart,
} from "@/lib/dashboard/dedupe";
import { writeErr, writeOk, type DomainWriteResult } from "@/lib/supabase/write-result";
import { removeWarrantyCard } from "@/lib/supabase/warranty-storage";

const TABLE = "appliances" as const;

export async function listAppliances(
  supabase: SupabaseClient,
  site?: ApplianceSite | null,
) {
  let query = supabase.from(TABLE).select("*");
  if (site) query = query.eq("site", site);
  return query
    .order("created_at", { ascending: false })
    .returns<Appliance[]>();
}

export async function getAppliance(supabase: SupabaseClient, id: string) {
  return supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle()
    .returns<Appliance>();
}

export async function findAppliancesByAssetTag(
  supabase: SupabaseClient,
  assetTag: string,
  site?: ApplianceSite | null,
): Promise<{ data: Appliance[]; error: string | null }> {
  const key = normalizeKeyPart(assetTag);
  if (!key) return { data: [], error: null };
  let query = supabase.from(TABLE).select("*").ilike("asset_tag", assetTag.trim());
  if (site) query = query.eq("site", site);
  const { data, error } = await query.returns<Appliance[]>();
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []).filter(
    (r) => normalizeKeyPart(r.asset_tag) === key,
  );
  return { data: rows.length ? rows : (data ?? []), error: null };
}

async function findApplianceDuplicate(
  supabase: SupabaseClient,
  assetTag: string,
  site: ApplianceSite,
): Promise<Appliance | null> {
  const { data } = await findAppliancesByAssetTag(supabase, assetTag, site);
  return data[0] ?? null;
}

export async function createAppliance(
  supabase: SupabaseClient,
  input: ApplianceInsert,
): Promise<DomainWriteResult<Appliance>> {
  const existing = await findApplianceDuplicate(
    supabase,
    input.asset_tag,
    input.site,
  );
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
      .single<Appliance>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select("*")
    .single<Appliance>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateAppliance(
  supabase: SupabaseClient,
  id: string,
  input: ApplianceUpdate,
) {
  return supabase.from(TABLE).update(input).eq("id", id).select("*").single();
}

export async function deleteAppliance(supabase: SupabaseClient, id: string) {
  const { data: existing } = await supabase
    .from(TABLE)
    .select("warranty_card_url")
    .eq("id", id)
    .maybeSingle();
  const path =
    existing && typeof existing === "object" && "warranty_card_url" in existing
      ? (existing.warranty_card_url as string | null)
      : null;
  if (path) {
    await removeWarrantyCard(supabase, path);
  }
  return supabase.from(TABLE).delete().eq("id", id);
}
