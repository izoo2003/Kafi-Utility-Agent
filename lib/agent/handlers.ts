import type { SupabaseClient, User } from "@supabase/supabase-js";
import { collectOpsAlerts } from "@/lib/alerts/collect";
import { isWriteTool } from "@/lib/agent/tools";
import { executeWriteTool } from "@/lib/agent/write-handlers";
import {
  getKitchenInventoryItem,
  kitchenInventoryStatus,
  listKitchenInventory,
} from "@/lib/supabase/kitchen-inventory";
import {
  getItEquipment,
  listItEquipment,
} from "@/lib/supabase/it-equipment";
import {
  listGeneratorFuelLog,
  listGeneratorMaintenance,
} from "@/lib/supabase/generator";
import { evaluateSnapshotAlerts } from "@/lib/sems/alert-rules";
import { isSemsConfigured } from "@/lib/sems/config";
import {
  getLatestSolarLiveSnapshot,
  listSolarMonitoringLog,
  listSolarSpecs,
} from "@/lib/supabase/solar";
import { listUtilityAccounts } from "@/lib/supabase/utilities";
import type { ItEquipment, KitchenInventory } from "@/lib/types/database";
import type { WriteToolName } from "@/lib/validations/agent-writes";

export type PendingConfirmation = {
  tool: WriteToolName;
  summary: string;
  args: Record<string, unknown>;
};

export type AgentToolContext = {
  supabase: SupabaseClient;
  user: User;
};

function clampLimit(value: unknown, fallback = 20) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), 100);
}

export function extractPendingConfirmation(
  toolResult: unknown,
): PendingConfirmation | null {
  if (
    toolResult &&
    typeof toolResult === "object" &&
    (toolResult as { status?: string }).status === "needs_confirmation"
  ) {
    const r = toolResult as {
      tool: WriteToolName;
      action_summary: string;
      args: Record<string, unknown>;
    };
    if (r.tool && r.action_summary && r.args) {
      return { tool: r.tool, summary: r.action_summary, args: r.args };
    }
  }
  return null;
}

export async function executeAgentTool(
  ctx: AgentToolContext,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  if (isWriteTool(name)) {
    return executeWriteTool(ctx, name as WriteToolName, input);
  }

  const { supabase } = ctx;

  switch (name) {
    case "ops_alerts_list": {
      const alerts = await collectOpsAlerts(supabase);
      return { count: alerts.length, alerts };
    }

    case "kitchen_inventory_list": {
      const { data, error } = await listKitchenInventory(supabase);
      if (error) throw new Error(error.message);
      const rows = ((data ?? []) as KitchenInventory[]).map((item) => ({
        ...item,
        status: kitchenInventoryStatus(item),
      }));
      if (input.low_only === true) {
        return rows.filter((r) => r.status === "low");
      }
      return rows;
    }

    case "kitchen_inventory_get": {
      const id = String(input.id ?? "");
      const { data, error } = await getKitchenInventoryItem(supabase, id);
      if (error) throw new Error(error.message);
      if (!data) return { error: "Not found" };
      const item = data as KitchenInventory;
      return { ...item, status: kitchenInventoryStatus(item) };
    }

    case "it_equipment_list": {
      const { data, error } = await listItEquipment(supabase);
      if (error) throw new Error(error.message);
      let rows = (data ?? []) as ItEquipment[];
      if (typeof input.status === "string") {
        rows = rows.filter((r) => r.status === input.status);
      }
      return rows;
    }

    case "it_equipment_get": {
      if (typeof input.id === "string" && input.id) {
        const { data, error } = await getItEquipment(supabase, input.id);
        if (error) throw new Error(error.message);
        return data ?? { error: "Not found" };
      }
      if (typeof input.asset_tag === "string" && input.asset_tag) {
        const { data, error } = await supabase
          .from("it_equipment")
          .select("*")
          .eq("asset_tag", input.asset_tag)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data ?? { error: "Not found" };
      }
      return { error: "Provide id or asset_tag" };
    }

    case "generator_maintenance_list": {
      const limit = clampLimit(input.limit);
      const { data, error } = await listGeneratorMaintenance(supabase);
      if (error) throw new Error(error.message);
      return (data ?? []).slice(0, limit);
    }

    case "generator_fuel_log_list": {
      const limit = clampLimit(input.limit);
      const { data, error } = await listGeneratorFuelLog(supabase);
      if (error) throw new Error(error.message);
      return (data ?? []).slice(0, limit);
    }

    case "solar_specs_list": {
      const { data, error } = await listSolarSpecs(supabase);
      if (error) throw new Error(error.message);
      return data ?? [];
    }

    case "solar_monitoring_list": {
      const limit = clampLimit(input.limit);
      const { data, error } = await listSolarMonitoringLog(supabase);
      if (error) throw new Error(error.message);
      let rows = (data ?? []) as Array<{ alert_flag?: boolean }>;
      if (input.alerts_only === true) {
        rows = rows.filter((r) => r.alert_flag === true);
      }
      return rows.slice(0, limit);
    }

    case "solar_live_get": {
      const { data, error } = await getLatestSolarLiveSnapshot(supabase);
      if (error) {
        if (/solar_live_snapshot|does not exist|schema cache/i.test(error.message)) {
          return {
            configured: false,
            snapshot: null,
            note: "solar_live_snapshot table is missing — run the SEMS migration.",
          };
        }
        throw new Error(error.message);
      }
      if (!data) {
        return {
          configured: isSemsConfigured(),
          snapshot: null,
          auto_alerts: evaluateSnapshotAlerts(null),
          note: "No live snapshot yet. Sync from the Solar dashboard or wait for cron.",
        };
      }
      return {
        configured: isSemsConfigured(),
        station_id: data.station_id,
        station_name: data.station_name,
        fetched_at: data.fetched_at,
        pv_power_kw: data.pv_power_kw,
        load_power_kw: data.load_power_kw,
        grid_power_kw: data.grid_power_kw,
        battery_power_kw: data.battery_power_kw,
        battery_soc_pct: data.battery_soc_pct,
        generation_today_kwh: data.generation_today_kwh,
        consumption_today_kwh: data.consumption_today_kwh,
        last_error: data.last_error,
        auto_alerts: evaluateSnapshotAlerts(data),
      };
    }

    case "utility_accounts_list": {
      const { data, error } = await listUtilityAccounts(supabase);
      if (error) throw new Error(error.message);
      let rows = data ?? [];
      if (typeof input.utility_type === "string") {
        rows = rows.filter((r) => r.utility_type === input.utility_type);
      }
      return rows.map((r) => ({
        id: r.id,
        utility_type: r.utility_type,
        provider: r.provider,
        account_number: r.account_number,
        billing_cycle: r.billing_cycle,
        monthly_avg_cost: r.monthly_avg_cost,
        due_date_day: r.due_date_day,
        contact_person: r.contact_person,
        notes: r.notes,
      }));
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
