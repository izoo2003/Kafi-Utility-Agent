import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GeneratorMaintenance,
  GeneratorRunLog,
  ItEquipment,
  KitchenInventory,
  SolarLiveSnapshot,
  SolarMonitoringLog,
  Tenant,
  TenantElectricBill,
  UtilityAccount,
  UtilityPaymentLog,
} from "@/lib/types/database";
import {
  evaluateSnapshotAlerts,
  findingsToOpsAlerts,
} from "@/lib/sems/alert-rules";
import type { OpsAlert } from "@/lib/alerts/types";
import {
  billStatus,
  latestPayment,
  nextDueFromLastPaid,
} from "@/lib/utilities/billing";
import { isActiveSiteUtilityProvider } from "@/lib/utilities/providers";
import {
  PROJECTED_EMPTY_CRITICAL_DAYS,
  assessKitchenStock,
} from "@/lib/kitchen/consumption";
import { kitchenReorderNotice } from "@/lib/kitchen/reorder-statement";
import {
  OIL_CHANGE_INTERVAL_HOURS,
  hoursRunSinceOilChange,
  lastOilChangeRecord,
  oilChangeStatus,
} from "@/lib/generator/oil-change";
import { formatDate } from "@/lib/format/datetime";
import {
  effectivePaymentStatus,
  formatMoney,
} from "@/lib/tenants/payment-status";

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
  const [
    kitchen,
    it,
    maintenance,
    runs,
    solar,
    live,
    utilities,
    payments,
    tenants,
    tenantBills,
  ] =
    await Promise.all([
      supabase.from("kitchen_inventory").select("*"),
      supabase.from("it_equipment").select("*"),
      supabase
        .from("generator_maintenance")
        .select("*")
        .order("service_date", { ascending: false }),
      supabase
        .from("generator_run_log")
        .select("run_date, hours_run"),
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
      supabase.from("utility_accounts").select("*"),
      supabase
        .from("utility_payment_logs")
        .select("*")
        .order("paid_on", { ascending: false }),
      supabase.from("tenants").select("*"),
      supabase
        .from("tenant_electric_bills")
        .select("*")
        .order("due_date", { ascending: false }),
    ]);

  const alerts: OpsAlert[] = [];
  const today = todayIso();
  const warrantyHorizon = addDaysIso(WARRANTY_WARNING_DAYS);
  const serviceHorizon = addDaysIso(SERVICE_WARNING_DAYS);

  for (const item of (kitchen.data ?? []) as KitchenInventory[]) {
    const assessment = assessKitchenStock(item);
    const notice = kitchenReorderNotice(item);
    const burn =
      assessment.daily_usage != null
        ? ` Est. burn ~${assessment.daily_usage.toFixed(3)}${item.unit ? ` ${item.unit}` : ""}/day.`
        : "";

    if (assessment.status === "out") {
      alerts.push({
        id: `kitchen-out-${item.id}`,
        domain: "kitchen",
        severity: "critical",
        title: `Reorder immediately: ${item.item_name}`,
        detail: `${notice.statement}${burn}`,
        href: "/dashboard/kitchen-inventory",
      });
      continue;
    }

    if (assessment.status === "low") {
      const criticalSoon =
        assessment.days_remaining != null &&
        assessment.days_remaining <= PROJECTED_EMPTY_CRITICAL_DAYS;
      alerts.push({
        id: `kitchen-low-${item.id}`,
        domain: "kitchen",
        severity: criticalSoon ? "critical" : "warning",
        title: `Quantity is low: ${item.item_name}`,
        detail: `${notice.statement}${burn}`,
        href: "/dashboard/kitchen-inventory",
      });
      continue;
    }

    if (assessment.status === "watch") {
      const criticalSoon =
        assessment.days_remaining != null &&
        assessment.days_remaining <= PROJECTED_EMPTY_CRITICAL_DAYS;
      alerts.push({
        id: `kitchen-watch-${item.id}`,
        domain: "kitchen",
        severity: criticalSoon ? "critical" : "warning",
        title: criticalSoon
          ? `Will run out soon: ${item.item_name}`
          : `Consider reordering: ${item.item_name}`,
        detail: `${notice.statement}${burn}`,
        href: "/dashboard/kitchen-inventory",
      });
    }
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

  // Generator monthly checkups: pending not_done rows, plus next due from latest done
  {
    const rows = (maintenance.data ?? []) as GeneratorMaintenance[];
    const notDone = rows.filter(
      (r) =>
        r.checkup_status === "not_done" &&
        (r.next_service_due || r.service_date),
    );
    const latestDone = [...rows]
      .filter((r) => r.checkup_status === "done")
      .sort((a, b) => b.service_date.localeCompare(a.service_date))[0];

    for (const row of notDone) {
      const due = row.next_service_due ?? row.service_date;
      if (due > serviceHorizon) continue;
      const remaining = daysUntil(due);
      const overdue = due < today;
      alerts.push({
        id: `generator-service-${row.id}`,
        domain: "generator",
        severity: overdue ? "critical" : "warning",
        title: overdue
          ? "Generator checkup not done (overdue)"
          : "Generator checkup not done",
        detail: overdue
          ? `${row.service_type ?? "Monthly checkup"} was due on ${due} and is still marked not done.`
          : `${row.service_type ?? "Monthly checkup"} due ${due} (${remaining} day${remaining === 1 ? "" : "s"}) — status: not done.`,
        href: "/dashboard/generator",
      });
    }

    if (
      latestDone?.next_service_due &&
      latestDone.next_service_due <= serviceHorizon &&
      !notDone.some(
        (r) =>
          (r.next_service_due ?? r.service_date) === latestDone.next_service_due,
      )
    ) {
      const due = latestDone.next_service_due;
      const remaining = daysUntil(due);
      const overdue = due < today;
      alerts.push({
        id: `generator-next-due-${latestDone.id}`,
        domain: "generator",
        severity: overdue ? "critical" : "warning",
        title: overdue
          ? "Generator monthly checkup overdue"
          : "Generator monthly checkup due soon",
        detail: overdue
          ? `Next checkup was due on ${due} (last done ${latestDone.service_date}). Mark done when completed.`
          : `Next checkup due ${due} (${remaining} day${remaining === 1 ? "" : "s"}) — last done ${latestDone.service_date}.`,
        href: "/dashboard/generator",
      });
    }

    // Oil change: every 200h of logged outage/run time (not live)
    if (
      !runs.error ||
      !/generator_run_log|does not exist|schema cache/i.test(
        runs.error.message,
      )
    ) {
      const lastOil = lastOilChangeRecord(rows);
      const since = hoursRunSinceOilChange(
        (runs.data ?? []) as Pick<GeneratorRunLog, "run_date" | "hours_run">[],
        lastOil?.service_date ?? null,
      );
      const { due, remaining } = oilChangeStatus(since);
      if (due) {
        alerts.push({
          id: "generator-oil-change",
          domain: "generator",
          severity: "critical",
          title: "Generator oil change needed",
          detail: lastOil
            ? `${since} h of outage runs logged since oil change on ${formatDate(lastOil.service_date)} (interval ${OIL_CHANGE_INTERVAL_HOURS} h).`
            : `${since} h of outage runs logged with no oil change yet (≥ ${OIL_CHANGE_INTERVAL_HOURS} h).`,
          href: "/dashboard/generator",
        });
      } else if (
        since > 0 &&
        remaining != null &&
        remaining <= 20 &&
        remaining > 0
      ) {
        alerts.push({
          id: "generator-oil-change-soon",
          domain: "generator",
          severity: "warning",
          title: "Generator oil change due soon",
          detail: `About ${remaining} h of generator run time left until the ${OIL_CHANGE_INTERVAL_HOURS} h oil-change interval (${since} h logged since last oil change).`,
          href: "/dashboard/generator",
        });
      }
    }
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

  // Utility bills: due one month after last paid
  if (
    !utilities.error ||
    !/utility_accounts|does not exist|schema cache/i.test(
      utilities.error.message,
    )
  ) {
    const accounts = (utilities.data ?? []) as UtilityAccount[];
    const allPayments = (payments.data ?? []) as UtilityPaymentLog[];
    const paymentsByAccount = new Map<string, UtilityPaymentLog[]>();
    for (const p of allPayments) {
      const list = paymentsByAccount.get(p.utility_account_id) ?? [];
      list.push(p);
      paymentsByAccount.set(p.utility_account_id, list);
    }

    for (const account of accounts) {
      if (!isActiveSiteUtilityProvider(account.provider)) continue;
      const label = account.provider?.trim() || account.utility_type;
      const last = latestPayment(paymentsByAccount.get(account.id) ?? []);
      if (!last) continue;
      const nextDue = nextDueFromLastPaid(last.paid_on);
      const status = billStatus(nextDue, today);
      if (status === "ok" || status === "unknown") continue;

      const remaining = daysUntil(nextDue);
      const overdue = status === "overdue";
      alerts.push({
        id: `utility-bill-${account.id}`,
        domain: "utilities",
        severity: overdue || status === "due_today" ? "critical" : "warning",
        title: overdue
          ? `Bill overdue: ${label}`
          : `Bill due: ${label}`,
        detail: overdue
          ? `${label} was due on ${formatDate(nextDue)} (last paid ${formatDate(last.paid_on)}).`
          : status === "due_today"
            ? `${label} is due today — last paid ${formatDate(last.paid_on)}.`
            : `${label} due ${formatDate(nextDue)} (${remaining} day${remaining === 1 ? "" : "s"}) — last paid ${formatDate(last.paid_on)}.`,
        href: "/dashboard/utilities",
      });
    }
  }

  if (
    !tenants.error ||
    !/tenants|does not exist|schema cache/i.test(tenants.error.message)
  ) {
    for (const tenant of (tenants.data ?? []) as Tenant[]) {
      const status = effectivePaymentStatus(
        tenant.payment_status,
        tenant.rent_due_date,
        today,
      );
      const outstanding = Number(tenant.outstanding_amount ?? 0);
      if (status !== "overdue" && !(status !== "paid" && outstanding > 0)) {
        if (status !== "unpaid" && status !== "partial") continue;
        if (!tenant.rent_due_date || tenant.rent_due_date > serviceHorizon) {
          continue;
        }
      }

      const overdue = status === "overdue";
      const dueSoon =
        !overdue &&
        tenant.rent_due_date != null &&
        tenant.rent_due_date <= serviceHorizon;
      if (!overdue && !dueSoon && outstanding <= 0) continue;

      alerts.push({
        id: `tenant-rent-${tenant.id}`,
        domain: "tenants",
        severity: overdue || outstanding > 0 ? "critical" : "warning",
        title: overdue
          ? `Rent overdue: ${tenant.tenant_name}`
          : outstanding > 0
            ? `Rent outstanding: ${tenant.tenant_name}`
            : `Rent due: ${tenant.tenant_name}`,
        detail: [
          tenant.rent_due_date
            ? `Due ${formatDate(tenant.rent_due_date)}`
            : null,
          tenant.rent_amount != null
            ? `rent ${formatMoney(tenant.rent_amount)}`
            : null,
          outstanding > 0
            ? `outstanding ${formatMoney(outstanding)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Rent payment needs attention.",
        href: `/dashboard/tenants/records?tenant=${tenant.id}`,
      });
    }
  }

  if (
    !tenantBills.error ||
    !/tenant_electric_bills|does not exist|schema cache/i.test(
      tenantBills.error.message,
    )
  ) {
    const tenantNames = new Map(
      ((tenants.data ?? []) as Tenant[]).map((t) => [t.id, t.tenant_name]),
    );
    const latestByTenant = new Map<string, TenantElectricBill>();
    for (const bill of (tenantBills.data ?? []) as TenantElectricBill[]) {
      if (!latestByTenant.has(bill.tenant_id)) {
        latestByTenant.set(bill.tenant_id, bill);
      }
    }
    for (const bill of latestByTenant.values()) {
      const status = effectivePaymentStatus(
        bill.payment_status,
        bill.due_date,
        today,
      );
      const outstanding = Number(bill.outstanding_amount ?? 0);
      const name = tenantNames.get(bill.tenant_id) ?? "Tenant";
      const overdue = status === "overdue";
      const dueSoon =
        !overdue &&
        bill.due_date != null &&
        bill.due_date <= serviceHorizon &&
        status !== "paid";
      if (!overdue && !dueSoon && !(status !== "paid" && outstanding > 0)) {
        continue;
      }
      alerts.push({
        id: `tenant-ke-${bill.tenant_id}`,
        domain: "tenants",
        severity: overdue || outstanding > 0 ? "critical" : "warning",
        title: overdue
          ? `Tenant electricity overdue: ${name}`
          : `Tenant electricity due: ${name}`,
        detail: [
          bill.due_date ? `Due ${formatDate(bill.due_date)}` : null,
          bill.ke_charges_amount != null
            ? `KE charges ${formatMoney(bill.ke_charges_amount)}`
            : null,
          outstanding > 0
            ? `outstanding ${formatMoney(outstanding)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Electricity bill needs attention.",
        href: `/dashboard/tenants/electricity?tenant=${bill.tenant_id}`,
      });
    }
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
    utilities: 4,
    tenants: 5,
  };

  return alerts.sort((a, b) => {
    const bySeverity = severityRank[a.severity] - severityRank[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return domainRank[a.domain] - domainRank[b.domain];
  });
}
