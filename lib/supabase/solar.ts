import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SolarLiveSnapshot,
  SolarLiveSnapshotUpsert,
  SolarMonitoringLog,
  SolarMonitoringLogInsert,
  SolarMonitoringLogUpdate,
  SolarSpecs,
  SolarSpecsInsert,
  SolarSpecsUpdate,
} from "@/lib/types/database";
import { SOLAR_SPECS_BUCKET } from "@/lib/types/database";
import {
  incomingShouldOverwrite,
  normalizeKeyPart,
} from "@/lib/dashboard/dedupe";
import { writeErr, writeOk, type DomainWriteResult } from "@/lib/supabase/write-result";

const SPECS = "solar_specs" as const;
const LOG = "solar_monitoring_log" as const;
const LIVE = "solar_live_snapshot" as const;

export { SOLAR_SPECS_BUCKET };

export async function listSolarSpecs(supabase: SupabaseClient) {
  return supabase
    .from(SPECS)
    .select("*")
    .order("created_at", { ascending: false })
    .returns<SolarSpecs[]>();
}

async function findSolarSpecsDuplicate(
  supabase: SupabaseClient,
  input: SolarSpecsInsert,
): Promise<SolarSpecs | null> {
  const inverterKey = normalizeKeyPart(input.inverter_model);
  const { data, error } = await supabase
    .from(SPECS)
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<SolarSpecs[]>();
  if (error || !data?.length) return null;
  if (inverterKey) {
    const match = data.find(
      (r) => normalizeKeyPart(r.inverter_model) === inverterKey,
    );
    if (match) return match;
  }
  // Single-system site: treat sole specs row as the duplicate target
  if (data.length === 1) return data[0]!;
  return null;
}

export async function createSolarSpecs(
  supabase: SupabaseClient,
  input: SolarSpecsInsert,
): Promise<DomainWriteResult<SolarSpecs>> {
  const existing = await findSolarSpecsDuplicate(supabase, input);
  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: input.install_date ?? input.warranty_expiry ?? null,
      existingDate: existing.install_date ?? existing.warranty_expiry,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) return writeOk(existing, "skipped");
    const { data, error } = await supabase
      .from(SPECS)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<SolarSpecs>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(SPECS)
    .insert(input)
    .select("*")
    .single<SolarSpecs>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
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
    .order("created_at", { ascending: false })
    .returns<SolarMonitoringLog[]>();
}

export async function createSolarMonitoringLog(
  supabase: SupabaseClient,
  input: SolarMonitoringLogInsert,
): Promise<DomainWriteResult<SolarMonitoringLog>> {
  const { data: matches, error: findError } = await supabase
    .from(LOG)
    .select("*")
    .eq("log_date", input.log_date)
    .order("updated_at", { ascending: false })
    .returns<SolarMonitoringLog[]>();
  if (findError) return writeErr(findError.message);

  const existing = matches?.[0] ?? null;
  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: input.log_date,
      existingDate: existing.log_date,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) return writeOk(existing, "skipped");
    const { data, error } = await supabase
      .from(LOG)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<SolarMonitoringLog>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(LOG)
    .insert(input)
    .select("*")
    .single<SolarMonitoringLog>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
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

export async function getLatestSolarLiveSnapshot(supabase: SupabaseClient) {
  return supabase
    .from(LIVE)
    .select("*")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle<SolarLiveSnapshot>();
}

export async function upsertSolarLiveSnapshot(
  supabase: SupabaseClient,
  input: SolarLiveSnapshotUpsert,
) {
  return supabase
    .from(LIVE)
    .upsert(input, { onConflict: "station_id" })
    .select("*")
    .single<SolarLiveSnapshot>();
}

/** Update today's monitoring row if present; otherwise insert a SEMS-synced row. */
export async function upsertSolarMonitoringLogByDate(
  supabase: SupabaseClient,
  input: {
    log_date: string;
    generation_kwh: number | null;
    consumption_kwh: number | null;
    battery_soc_pct: number | null;
    alert_flag?: boolean;
    notes?: string;
  },
) {
  const existing = await supabase
    .from(LOG)
    .select("*")
    .eq("log_date", input.log_date)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<SolarMonitoringLog>();

  if (existing.error) return existing;

  const alertFlag = input.alert_flag ?? false;

  if (existing.data) {
    return supabase
      .from(LOG)
      .update({
        generation_kwh: input.generation_kwh,
        consumption_kwh: input.consumption_kwh,
        battery_soc_pct: input.battery_soc_pct,
        alert_flag: alertFlag,
        notes: input.notes ?? existing.data.notes,
      })
      .eq("id", existing.data.id)
      .select("*")
      .single<SolarMonitoringLog>();
  }

  return supabase
    .from(LOG)
    .insert({
      log_date: input.log_date,
      generation_kwh: input.generation_kwh,
      consumption_kwh: input.consumption_kwh,
      battery_soc_pct: input.battery_soc_pct,
      alert_flag: alertFlag,
      notes: input.notes ?? "Synced from SEMS+",
    } satisfies SolarMonitoringLogInsert)
    .select("*")
    .single<SolarMonitoringLog>();
}
