/**
 * Seed SunGrow Office static solar data (specs, monitoring logs, live snapshot).
 * Run: npx tsx scripts/seed-sungrow-office.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  buildSungrowMonitoringSeeds,
  SUNGROW_OFFICE_STATION_ID,
  sungrowOfficeSnapshot,
  sungrowOfficeSpecs,
} from "../lib/solar/static-sites/sungrow-office";

config();

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL / service role key in .env");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function upsertSpecs() {
  const { data: existing } = await supabase
    .from("solar_specs")
    .select("id, inverter_model")
    .ilike("inverter_model", "%SG33CX%")
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("solar_specs")
      .update(sungrowOfficeSpecs)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    console.log("Updated solar specs for SG33CX");
    return;
  }

  const { error } = await supabase.from("solar_specs").insert(sungrowOfficeSpecs);
  if (error) throw new Error(error.message);
  console.log("Created solar specs for SunGrow Office");
}

async function upsertMonitoringLogs() {
  const rows = buildSungrowMonitoringSeeds();
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const { data: existing } = await supabase
      .from("solar_monitoring_log")
      .select("id")
      .eq("station_id", SUNGROW_OFFICE_STATION_ID)
      .eq("log_date", row.log_date)
      .maybeSingle();

    const payload = {
      station_id: SUNGROW_OFFICE_STATION_ID,
      log_date: row.log_date,
      generation_kwh: row.generation_kwh,
      consumption_kwh: row.consumption_kwh,
      to_load_kwh: row.to_load_kwh,
      to_grid_kwh: row.to_grid_kwh,
      from_pv_bat_kwh: row.from_pv_bat_kwh,
      from_grid_kwh: row.from_grid_kwh,
      battery_soc_pct: null,
      alert_flag: false,
      notes: row.notes,
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("solar_monitoring_log")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      updated++;
    } else {
      const { error } = await supabase
        .from("solar_monitoring_log")
        .insert(payload);
      if (error) throw new Error(error.message);
      created++;
    }
  }

  console.log(
    `Monitoring logs: ${created} created, ${updated} updated (${rows.length} total rows)`,
  );
}

async function upsertSnapshot() {
  const { error } = await supabase
    .from("solar_live_snapshot")
    .upsert(sungrowOfficeSnapshot, { onConflict: "station_id" });
  if (error) throw new Error(error.message);
  console.log("Upserted static live snapshot for SunGrow Office");
}

async function main() {
  await upsertSpecs();
  await upsertMonitoringLogs();
  await upsertSnapshot();
  console.log("SunGrow Office static seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
