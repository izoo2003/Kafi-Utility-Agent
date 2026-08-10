import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SolarMonitoringLog,
  SolarMonitoringLogInsert,
  SolarMonitoringLogUpdate,
  SolarSpecs,
  SolarSpecsInsert,
  SolarSpecsUpdate,
} from "@/lib/types/database";
import { SOLAR_SPECS_BUCKET } from "@/lib/types/database";

const SPECS = "solar_specs" as const;
const LOG = "solar_monitoring_log" as const;

export { SOLAR_SPECS_BUCKET };

export async function listSolarSpecs(supabase: SupabaseClient) {
  return supabase
    .from(SPECS)
    .select("*")
    .order("created_at", { ascending: false })
    .returns<SolarSpecs[]>();
}

export async function createSolarSpecs(
  supabase: SupabaseClient,
  input: SolarSpecsInsert,
) {
  return supabase.from(SPECS).insert(input).select("*").single();
}

export async function updateSolarSpecs(
  supabase: SupabaseClient,
  id: string,
  input: SolarSpecsUpdate,
) {
  return supabase.from(SPECS).update(input).eq("id", id).select("*").single();
}

export async function deleteSolarSpecs(supabase: SupabaseClient, id: string) {
  return supabase.from(SPECS).delete().eq("id", id);
}

export async function listSolarMonitoringLog(supabase: SupabaseClient) {
  return supabase
    .from(LOG)
    .select("*")
    .order("log_date", { ascending: false })
    .returns<SolarMonitoringLog[]>();
}

export async function createSolarMonitoringLog(
  supabase: SupabaseClient,
  input: SolarMonitoringLogInsert,
) {
  return supabase.from(LOG).insert(input).select("*").single();
}

export async function updateSolarMonitoringLog(
  supabase: SupabaseClient,
  id: string,
  input: SolarMonitoringLogUpdate,
) {
  return supabase.from(LOG).update(input).eq("id", id).select("*").single();
}

export async function deleteSolarMonitoringLog(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(LOG).delete().eq("id", id);
}
