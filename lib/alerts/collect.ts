import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GeneratorMaintenance,
  ItEquipment,
  KitchenInventory,
  SolarLiveSnapshot,
  SolarMonitoringLog,
} from "@/lib/types/database";
import {
  evaluateSnapshotAlerts,
  findingsToOpsAlerts,
} from "@/lib/sems/alert-rules";
import { kitchenInventoryStatus } from "@/lib/supabase/kitchen-inventory";
import type { OpsAlert } from "@/lib/alerts/types";

const WARRANTY_WARNING_DAYS = 30;
const SERVICE_WARNING_DAYS = 14;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateIso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateIso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export async function collectOpsAlerts(
  supabase: SupabaseClient,
): Promise<OpsAlert[]> {
  const [kitchen, it, maintenance, solar, live] = await Promise.all([
    supabase.from("kitchen_inventory").select("*"),
    supabase.from("it_equipment").select("*"),
    supabase
      .from("generator_maintenance")
      .select("*")
      .not("next_service_due", "is", null)
      .order("next_service_due", { ascending: true }),
    supabase
      .from("solar_monitoring_log")
      .select("*")
      .eq("alert_flag", true)
      .order("log_date", { ascending: false }),
    supabase
      .from("solar_live_snapshot")
      .select("*")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const alerts: OpsAlert[] = [];
  const today = todayIso();
  const warrantyHorizon = addDaysIso(WARRANTY_WARNING_DAYS);
  const serviceHorizon = addDaysIso(SERVICE_WARNING_DAYS);

  for (const item of (kitchen.data ?? []) as KitchenInventory[]) {
    if (kitchenInventoryStatus(item) !== "low") continue;
    alerts.push({
      id: `kitchen-low-${item.id}`,
      domain: "kitchen",
      severity: "critical",
      title: `Low stock: ${item.item_name}`,
      detail: `${item.current_qty}${item.unit ? ` ${item.unit}` : ""} on hand — reorder level is ${item.reorder_level}${item.unit ? ` ${item.unit}` : ""}.`,
      href: "/dashboard/kitchen-inventory",
    });
  }

  for (const item of (it.data ?? []) as ItEquipment[]) {
    if (!item.warranty_expiry) continue;
    if (item.status === "retired") continue;
    if (item.warranty_expiry > warrantyHorizon) continue;

    const remaining = daysUntil(item.warranty_expiry);
    const overdue = item.warranty_expiry < today;
    alerts.push({
      id: `it-warranty-${item.id}`,
      domain: "it",
      severity: overdue ? "critical" : "warning",
      title: overdue
        ? `Warranty expired: ${item.asset_tag}`
        : `Warranty expiring: ${item.asset_tag}`,
      detail: overdue
        ? `${item.item_name} warranty ended on ${item.warranty_expiry}.`
        : `${item.item_name} warranty ends on ${item.warranty_expiry} (${remaining} day${remaining === 1 ? "" : "s"}).`,
      href: "/dashboard/it-equipment",
    });
  }

  // One alert per upcoming/overdue service record within window
  for (const row of (maintenance.data ?? []) as GeneratorMaintenance[]) {
    if (!row.next_service_due) continue;
    if (row.next_service_due > serviceHorizon) continue;

    const remaining = daysUntil(row.next_service_due);
    const overdue = row.next_service_due < today;
    alerts.push({
      id: `generator-service-${row.id}`,
      domain: "generator",
      severity: overdue ? "critical" : "warning",
      title: overdue
        ? "Generator service overdue"
        : "Generator service due soon",
      detail: overdue
        ? `${row.service_type ?? "Service"} was due on ${row.next_service_due}${row.vendor ? ` (${row.vendor})` : ""}.`
        : `${row.service_type ?? "Service"} due on ${row.next_service_due} (${remaining} day${remaining === 1 ? "" : "s"})${row.vendor ? ` — ${row.vendor}` : ""}.`,
      href: "/dashboard/generator",
    });
  }

  // Live SEMS+ baselines (SOC, daytime PV, stale sync, sync errors)
  if (
    !live.error ||
    !/solar_live_snapshot|does not exist|schema cache/i.test(
      live.error.message,
    )
  ) {
    const snapshot = (live.data ?? null) as SolarLiveSnapshot | null;
    alerts.push(...findingsToOpsAlerts(evaluateSnapshotAlerts(snapshot)));
  }

  for (const row of (solar.data ?? []) as SolarMonitoringLog[]) {
    // Skip rows that only mirror SEMS auto-alerts already covered above
    if (row.notes?.startsWith("SEMS+ auto-alert:")) continue;
    alerts.push({
      id: `solar-alert-${row.id}`,
      domain: "solar",
      severity: "warning",
      title: `Solar alert on ${row.log_date}`,
      detail:
        row.notes?.trim() ||
        `Monitoring flagged an alert${row.generation_kwh != null ? ` — generation ${row.generation_kwh} kWh` : ""}${row.battery_soc_pct != null ? `, battery ${row.battery_soc_pct}%` : ""}.`,
      href: "/dashboard/solar",
    });
  }

  const severityRank: Record<OpsAlert["severity"], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  // High-priority domains first (kitchen, IT, generator, solar), then severity
  const domainRank: Record<OpsAlert["domain"], number> = {
    kitchen: 0,
    it: 1,
    generator: 2,
    solar: 3,
  };

  return alerts.sort((a, b) => {
    const bySeverity = severityRank[a.severity] - severityRank[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return domainRank[a.domain] - domainRank[b.domain];
  });
}
