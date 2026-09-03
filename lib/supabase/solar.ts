import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SolarLiveSnapshot,
  SolarLiveSnapshotUpsert,
  SolarMaintenance,
  SolarMaintenanceInsert,
  SolarMaintenanceUpdate,
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
import { getSolarSite } from "@/lib/sems/sites";

const SPECS = "solar_specs" as const;
const LOG = "solar_monitoring_log" as const;
const LIVE = "solar_live_snapshot" as const;
const MAINTENANCE = "solar_maintenance" as const;

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

export async function listSolarMonitoringLog(
  supabase: SupabaseClient,
  stationId?: string,
) {
  let query = supabase.from(LOG).select("*");
  if (stationId) {
    query = query.eq("station_id", stationId);
  }
  return query
    .order("log_date", { ascending: false })
    .returns<SolarMonitoringLog[]>();
}

export async function createSolarMonitoringLog(
  supabase: SupabaseClient,
  input: SolarMonitoringLogInsert,
): Promise<DomainWriteResult<SolarMonitoringLog>> {
  const stationId =
    input.station_id?.trim() || getSolarSite()?.stationId || null;
  if (!stationId) {
    return writeErr("station_id is required (no default solar site configured)");
  }

  const payload = { ...input, station_id: stationId };

  const { data: matches, error: findError } = await supabase
    .from(LOG)
    .select("*")
    .eq("station_id", stationId)
    .eq("log_date", payload.log_date)
    .order("updated_at", { ascending: false })
    .returns<SolarMonitoringLog[]>();
  if (findError) return writeErr(findError.message);

  const existing = matches?.[0] ?? null;
  if (existing) {
    const { data, error } = await supabase
      .from(LOG)
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single<SolarMonitoringLog>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(LOG)
    .insert(payload)
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

export async function getSolarLiveSnapshot(
  supabase: SupabaseClient,
  stationId: string,
) {
  return supabase
    .from(LIVE)
    .select("*")
    .eq("station_id", stationId)
    .maybeSingle<SolarLiveSnapshot>();
}

export async function listSolarLiveSnapshots(supabase: SupabaseClient) {
  return supabase
    .from(LIVE)
    .select("*")
    .order("fetched_at", { ascending: false })
    .returns<SolarLiveSnapshot[]>();
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

/** Update the monitoring row for that calendar day if present; otherwise insert. */
export async function upsertSolarMonitoringLogByDate(
  supabase: SupabaseClient,
  input: {
    station_id: string;
    log_date: string;
    generation_kwh: number | null;
    consumption_kwh: number | null;
    to_load_kwh?: number | null;
    to_grid_kwh?: number | null;
    from_grid_kwh?: number | null;
    from_pv_bat_kwh?: number | null;
    battery_soc_pct: number | null;
    alert_flag?: boolean;
    notes?: string;
  },
) {
  const existing = await supabase
    .from(LOG)
    .select("*")
    .eq("station_id", input.station_id)
    .eq("log_date", input.log_date)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<SolarMonitoringLog>();

  if (existing.error) return existing;

  const alertFlag = input.alert_flag ?? false;
  const patch = {
    generation_kwh: input.generation_kwh,
    consumption_kwh: input.consumption_kwh,
    to_load_kwh:
      input.to_load_kwh !== undefined
        ? input.to_load_kwh
        : (existing.data?.to_load_kwh ?? null),
    to_grid_kwh:
      input.to_grid_kwh !== undefined
        ? input.to_grid_kwh
        : (existing.data?.to_grid_kwh ?? null),
    from_grid_kwh:
      input.from_grid_kwh !== undefined
        ? input.from_grid_kwh
        : (existing.data?.from_grid_kwh ?? null),
    from_pv_bat_kwh:
      input.from_pv_bat_kwh !== undefined
        ? input.from_pv_bat_kwh
        : (existing.data?.from_pv_bat_kwh ?? null),
    battery_soc_pct: input.battery_soc_pct,
    alert_flag: alertFlag,
    notes: input.notes ?? existing.data?.notes ?? "Synced from SEMS+",
  };

  if (existing.data) {
    return supabase
      .from(LOG)
      .update(patch)
      .eq("id", existing.data.id)
      .select("*")
      .single<SolarMonitoringLog>();
  }

  return supabase
    .from(LOG)
    .insert({
      station_id: input.station_id,
      log_date: input.log_date,
      ...patch,
    } satisfies SolarMonitoringLogInsert)
    .select("*")
    .single<SolarMonitoringLog>();
}

export async function listSolarMaintenance(supabase: SupabaseClient) {
  return supabase
    .from(MAINTENANCE)
    .select("*")
    .order("service_date", { ascending: false })
    .returns<SolarMaintenance[]>();
}

async function findSolarMaintenanceDuplicate(
  supabase: SupabaseClient,
  input: SolarMaintenanceInsert,
): Promise<SolarMaintenance | null> {
  const typeKey = normalizeKeyPart(input.service_type);
  const { data, error } = await supabase
    .from(MAINTENANCE)
    .select("*")
    .eq("site_id", input.site_id)
    .eq("service_date", input.service_date)
    .returns<SolarMaintenance[]>();
  if (error || !data?.length) return null;
  if (!typeKey) {
    return (
      [...data].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ??
      null
    );
  }
  return data.find((r) => normalizeKeyPart(r.service_type) === typeKey) ?? null;
}

export async function createSolarMaintenance(
  supabase: SupabaseClient,
  input: SolarMaintenanceInsert,
): Promise<DomainWriteResult<SolarMaintenance>> {
  const existing = await findSolarMaintenanceDuplicate(supabase, input);
  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: input.service_date,
      existingDate: existing.service_date,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) return writeOk(existing, "skipped");
    const { data, error } = await supabase
      .from(MAINTENANCE)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<SolarMaintenance>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(MAINTENANCE)
    .insert(input)
    .select("*")
    .single<SolarMaintenance>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateSolarMaintenance(
  supabase: SupabaseClient,
  id: string,
  input: SolarMaintenanceUpdate,
) {
  return supabase
    .from(MAINTENANCE)
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
}

export async function deleteSolarMaintenance(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(MAINTENANCE).delete().eq("id", id);
}
