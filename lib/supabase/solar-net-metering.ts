import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeBillExtraction } from "@/lib/solar/net-metering-ai";

export type SolarNetMeteringLog = {
  id: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  solar_site_id: string | null;
  ke_account_number: string | null;
  consumer_name: string | null;
  bill_period_label: string | null;
  bill_month: string | null;
  previous_balance_rs: number;
  net_metering_rs: number | null;
  consumed_rs: number | null;
  gross_balance_rs: number | null;
  refund_rs: number;
  net_balance_rs: number | null;
  estimated_refund_rs: number | null;
  units_import_kwh: number | null;
  units_export_kwh: number | null;
  payable_rs: number | null;
  bill_file_path: string | null;
  ai_extraction: KeBillExtraction | Record<string, unknown> | null;
  ai_narrative: string | null;
  sems_export_kwh: number | null;
  notes: string | null;
};

export type SolarNetMeteringLogInsert = {
  solar_site_id: string;
  ke_account_number?: string | null;
  consumer_name?: string | null;
  bill_period_label?: string | null;
  bill_month?: string | null;
  previous_balance_rs: number;
  net_metering_rs?: number | null;
  consumed_rs?: number | null;
  gross_balance_rs?: number | null;
  refund_rs?: number;
  net_balance_rs?: number | null;
  estimated_refund_rs?: number | null;
  units_import_kwh?: number | null;
  units_export_kwh?: number | null;
  payable_rs?: number | null;
  bill_file_path?: string | null;
  ai_extraction?: KeBillExtraction | Record<string, unknown> | null;
  ai_narrative?: string | null;
  sems_export_kwh?: number | null;
  notes?: string | null;
  updated_by?: string | null;
};

const TABLE = "solar_net_metering_logs" as const;

export type ListSolarNetMeteringFilters = {
  siteId?: string | null;
  accountNumber?: string | null;
};

export async function listSolarNetMeteringLogs(
  supabase: SupabaseClient,
  filters: ListSolarNetMeteringFilters = {},
) {
  let query = supabase.from(TABLE).select("*");
  if (filters.siteId?.trim()) {
    query = query.eq("solar_site_id", filters.siteId.trim());
  }
  if (filters.accountNumber?.trim()) {
    query = query.eq("ke_account_number", filters.accountNumber.trim());
  }
  return query
    .order("bill_month", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<SolarNetMeteringLog[]>();
}

export async function getLatestNetBalanceForSite(
  supabase: SupabaseClient,
  siteId: string,
) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("net_balance_rs, bill_month, bill_period_label, ke_account_number")
    .eq("solar_site_id", siteId.trim())
    .order("bill_month", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error };
  return {
    data: data as {
      net_balance_rs: number | null;
      bill_month: string | null;
      bill_period_label: string | null;
      ke_account_number: string | null;
    } | null,
    error: null,
  };
}

export async function createSolarNetMeteringLog(
  supabase: SupabaseClient,
  input: SolarNetMeteringLogInsert,
) {
  const siteId = input.solar_site_id?.trim();
  const month = input.bill_month?.trim();
  if (siteId && month) {
    const { data: existing } = await supabase
      .from(TABLE)
      .select("*")
      .eq("solar_site_id", siteId)
      .eq("bill_month", month)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<SolarNetMeteringLog>();
    if (existing) {
      return supabase
        .from(TABLE)
        .update(input)
        .eq("id", existing.id)
        .select("*")
        .single<SolarNetMeteringLog>();
    }
  }

  return supabase
    .from(TABLE)
    .insert(input)
    .select("*")
    .single<SolarNetMeteringLog>();
}

export async function deleteSolarNetMeteringLog(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(TABLE).delete().eq("id", id);
}

export function netMeteringBillPath(logId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `net-metering/${logId}/${Date.now()}-${safe}`;
}
