import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WithholdingTaxSlab,
  WithholdingTaxSlabInsert,
  WithholdingTaxSlabUpdate,
} from "@/lib/types/database";
import {
  writeErr,
  writeOk,
  type DomainWriteResult,
} from "@/lib/supabase/write-result";
import { monthlyTotal } from "@/lib/tenants/ledger";
import { withholdingForTenant } from "@/lib/tenants/withholding-tax";
import type { FrozenLineItem } from "@/lib/tenants/ledger";

const SLABS = "withholding_tax_slabs" as const;
const TENANTS = "tenants" as const;
const SCHEDULE = "tenant_rent_schedule" as const;

export async function listWithholdingTaxSlabs(supabase: SupabaseClient) {
  return supabase
    .from(SLABS)
    .select("*")
    .order("min_amount", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<WithholdingTaxSlab[]>();
}

export async function getWithholdingTaxSlab(
  supabase: SupabaseClient,
  id: string,
) {
  const { data, error } = await supabase
    .from(SLABS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: (data as WithholdingTaxSlab | null) ?? null, error };
}

export async function createWithholdingTaxSlab(
  supabase: SupabaseClient,
  input: WithholdingTaxSlabInsert,
): Promise<DomainWriteResult<WithholdingTaxSlab>> {
  const { data, error } = await supabase
    .from(SLABS)
    .insert({
      label: input.label ?? null,
      min_amount: Number(input.min_amount ?? 0),
      max_amount: input.max_amount ?? null,
      rate_percent: Number(input.rate_percent),
      notes: input.notes ?? null,
      updated_by: input.updated_by ?? null,
    })
    .select("*")
    .single<WithholdingTaxSlab>();
  if (error) return writeErr(error.message);
  const reapplied = await reapplyWithholdingOnOfficialSchedules(supabase);
  if (reapplied.error) return writeErr(reapplied.error.message);
  return writeOk(data, "created");
}

export async function updateWithholdingTaxSlab(
  supabase: SupabaseClient,
  id: string,
  input: WithholdingTaxSlabUpdate,
) {
  const { data, error } = await supabase
    .from(SLABS)
    .update(input)
    .eq("id", id)
    .select("*")
    .single<WithholdingTaxSlab>();
  if (error) return { data: null, error };
  const reapplied = await reapplyWithholdingOnOfficialSchedules(supabase);
  if (reapplied.error) {
    return { data: null, error: { message: reapplied.error.message } };
  }
  return { data, error: null };
}

export async function deleteWithholdingTaxSlab(
  supabase: SupabaseClient,
  id: string,
) {
  const { error } = await supabase.from(SLABS).delete().eq("id", id);
  if (error) return { error };
  return reapplyWithholdingOnOfficialSchedules(supabase);
}

/** Recalculate WHT + net total_due on official tenant schedule rows without deleting payments. */
export async function reapplyWithholdingOnOfficialSchedules(
  supabase: SupabaseClient,
) {
  const [slabsRes, tenantsRes] = await Promise.all([
    listWithholdingTaxSlabs(supabase),
    supabase
      .from(TENANTS)
      .select("id, classification")
      .eq("classification", "official"),
  ]);
  if (slabsRes.error) return { error: { message: slabsRes.error.message } };
  if (tenantsRes.error) return { error: { message: tenantsRes.error.message } };

  const slabs = slabsRes.data ?? [];
  const tenantIds = (tenantsRes.data ?? []).map((t) => t.id as string);
  if (tenantIds.length === 0) return { error: null };

  const { data: rows, error } = await supabase
    .from(SCHEDULE)
    .select("*")
    .in("tenant_id", tenantIds);
  if (error) return { error: { message: error.message } };

  for (const row of rows ?? []) {
    const frozen = Array.isArray(row.line_items)
      ? (row.line_items as FrozenLineItem[])
      : [];
    const rent = monthlyTotal(row.gross_rent, frozen);
    const wht = withholdingForTenant({
      classification: "official",
      monthlyRent: rent,
      slabs,
    });
    const { error: updErr } = await supabase
      .from(SCHEDULE)
      .update({
        withholding_tax: wht.withholding_tax,
        total_due: wht.total_due,
      })
      .eq("id", row.id);
    if (updErr) return { error: { message: updErr.message } };
  }
  return { error: null };
}
