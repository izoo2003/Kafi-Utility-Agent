import type { SupabaseClient, User } from "@supabase/supabase-js";
import { collectOpsAlerts } from "@/lib/alerts/collect";
import { isWriteTool } from "@/lib/agent/tools";
import { executeWriteTool } from "@/lib/agent/write-handlers";
import {
  getKitchenInventoryItem,
  kitchenInventoryAssessment,
  listKitchenInventory,
} from "@/lib/supabase/kitchen-inventory";
import { kitchenReorderNotice } from "@/lib/kitchen/reorder-statement";
import {
  getItEquipment,
  listItEquipment,
} from "@/lib/supabase/it-equipment";
import {
  getAppliance,
  listAppliances,
} from "@/lib/supabase/appliances";
import {
  listGeneratorExpenses,
  listGeneratorFuelLog,
  listGeneratorMaintenance,
} from "@/lib/supabase/generator";
import { nextDueFromMaintenanceRows } from "@/lib/generator/maintenance";
import { evaluateSnapshotAlerts } from "@/lib/sems/alert-rules";
import { isSemsConfigured } from "@/lib/sems/config";
import {
  getSolarLiveSnapshot,
  listSolarMonitoringLog,
  listSolarSpecs,
} from "@/lib/supabase/solar";
import {
  listUtilityAccounts,
  listUtilityPaymentLogs,
} from "@/lib/supabase/utilities";
import {
  findTenantByName,
  getTenant,
  listTenantElectricBills,
  listTenantRentLogs,
  listTenants,
} from "@/lib/supabase/tenants";
import {
  listChartOfAccountsEntries,
} from "@/lib/supabase/chart-of-accounts";
import { withRunningBalances } from "@/lib/chart-of-accounts/balance";
import { chartOfAccountsLedgerSchema } from "@/lib/validations/chart-of-accounts";
import {
  latestPayment,
  nextDueFromLastPaid,
} from "@/lib/utilities/billing";
import { providerByLabel, isActiveSiteUtilityProvider } from "@/lib/utilities/providers";
import type {
  Appliance,
  ItEquipment,
  KitchenInventory,
  Tenant,
} from "@/lib/types/database";
import { normalizeKeyPart } from "@/lib/dashboard/dedupe";
import type { WriteToolName } from "@/lib/validations/agent-writes";
import { truncatedList } from "@/lib/agent/grounding";

export type PendingConfirmation = {
  tool: WriteToolName;
  summary: string;
  args: Record<string, unknown>;
};

export type AgentToolContext = {
  supabase: SupabaseClient;
  user: User;
};

function clampLimit(value: unknown, fallback = 40) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), 200);
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
  options?: { allowConfirm?: boolean },
): Promise<unknown> {
  if (isWriteTool(name)) {
    // Model-invoked writes must never self-confirm; only the UI confirm path may.
    const safeInput = options?.allowConfirm
      ? input
      : { ...input, confirmed: false };
    return executeWriteTool(ctx, name as WriteToolName, safeInput);
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
      const rows = ((data ?? []) as KitchenInventory[]).map((item) => {
        const a = kitchenInventoryAssessment(item);
        const notice = kitchenReorderNotice(item);
        return {
          ...item,
          status: a.status,
          reorder_statement: notice.statement,
          daily_usage_estimate: a.daily_usage,
          days_remaining_estimate: a.days_remaining,
          consumable: a.consumable,
          consumption_note: a.profile?.note ?? null,
        };
      });
      if (input.low_only === true) {
        return rows.filter(
          (r) => r.status === "low" || r.status === "out" || r.status === "watch",
        );
      }
      return rows;
    }

    case "kitchen_inventory_get": {
      const id = String(input.id ?? "");
      const { data, error } = await getKitchenInventoryItem(supabase, id);
      if (error) throw new Error(error.message);
      if (!data) return { error: "Not found" };
      const item = data as KitchenInventory;
      const a = kitchenInventoryAssessment(item);
      const notice = kitchenReorderNotice(item);
      return {
        ...item,
        status: a.status,
        reorder_statement: notice.statement,
        daily_usage_estimate: a.daily_usage,
        days_remaining_estimate: a.days_remaining,
        consumable: a.consumable,
        consumption_note: a.profile?.note ?? null,
      };
    }

    case "kitchen_monthly_consumption": {
      const { currentSiteMonth } = await import(
        "@/lib/kitchen/monthly-consumption"
      );
      const { buildKitchenEdaAnalytics } = await import(
        "@/lib/kitchen/eda-analytics"
      );
      const month =
        typeof input.month === "string" && input.month.trim()
          ? input.month.trim()
          : currentSiteMonth();
      const eda = await buildKitchenEdaAnalytics(supabase, month);
      if (input.with_ai_summary === true) {
        const { generateKitchenEdaInsights } = await import(
          "@/lib/kitchen/monthly-summary-ai"
        );
        const ai = await generateKitchenEdaInsights(eda);
        return {
          report: eda.report,
          eda: {
            kpis: eda.kpis,
            alerts: eda.alerts,
            top_out_items: eda.top_out_items,
            category_mix: eda.category_mix,
            month_trend: eda.month_trend,
            stock_health: eda.stock_health,
          },
          ai_summary: ai.summary,
          model: ai.model,
        };
      }
      return {
        report: eda.report,
        eda: {
          kpis: eda.kpis,
          alerts: eda.alerts,
          top_out_items: eda.top_out_items,
          category_mix: eda.category_mix,
          month_trend: eda.month_trend,
          stock_health: eda.stock_health,
        },
      };
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

    case "appliances_list": {
      const { data, error } = await listAppliances(supabase);
      if (error) throw new Error(error.message);
      let rows = (data ?? []) as Appliance[];
      if (typeof input.status === "string") {
        rows = rows.filter((r) => r.status === input.status);
      }
      return rows;
    }

    case "appliances_get": {
      if (typeof input.id === "string" && input.id) {
        const { data, error } = await getAppliance(supabase, input.id);
        if (error) throw new Error(error.message);
        return data ?? { error: "Not found" };
      }
      if (typeof input.asset_tag === "string" && input.asset_tag) {
        const { data, error } = await supabase
          .from("appliances")
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
      const rows = data ?? [];
      const schedule = nextDueFromMaintenanceRows(rows);
      return truncatedList(rows, limit, {
        schedule: {
          next_maintenance_due: schedule.nextDue,
          last_maintenance_done: schedule.lastDoneDate,
          has_pending_not_done: schedule.pendingNotDone,
          cadence: "Monthly checkup (about every 1 month)",
        },
      });
    }

    case "generator_fuel_log_list": {
      const limit = clampLimit(input.limit);
      const { data, error } = await listGeneratorFuelLog(supabase);
      if (error) throw new Error(error.message);
      return truncatedList(data ?? [], limit);
    }

    case "generator_expense_list": {
      const limit = clampLimit(input.limit, 50);
      const { data, error } = await listGeneratorExpenses(supabase);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const totalDebit = rows.reduce(
        (sum, r) => sum + (Number(r.debit) || 0),
        0,
      );
      return truncatedList(rows, limit, {
        total_expense: totalDebit,
        total_debit: totalDebit,
        currency_note: "Sum of debit column (all rows, not just returned)",
      });
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
      return truncatedList(rows, limit);
    }

    case "solar_energy_summary": {
      const { getSolarSite, isSemsConfigured } = await import(
        "@/lib/sems/config"
      );
      const siteId =
        typeof input.site_id === "string" && input.site_id.trim()
          ? input.site_id.trim()
          : null;
      const config = getSolarSite(siteId);
      if (!config) {
        return {
          configured: isSemsConfigured(),
          error: siteId
            ? `Unknown solar site "${siteId}"`
            : "SEMS+ is not configured",
        };
      }
      const { buildSolarEnergySummary, currentSiteMonth } = await import(
        "@/lib/solar/energy-summary"
      );
      const month =
        typeof input.month === "string" && input.month.trim()
          ? input.month.trim()
          : currentSiteMonth(config.timeZone);
      const summary = await buildSolarEnergySummary(supabase, config, month);
      if (input.with_ai_summary === true) {
        const { generateSolarEnergySummaryAi } = await import(
          "@/lib/solar/energy-summary-ai"
        );
        const ai = await generateSolarEnergySummaryAi(summary);
        return {
          summary: {
            site_id: summary.site_id,
            site_label: summary.site_label,
            station_id: summary.station_id,
            station_name: summary.station_name,
            month: summary.month,
            generated_kwh: summary.generated_kwh,
            consumed_kwh: summary.consumed_kwh,
            exported_kwh: summary.exported_kwh,
            to_load_kwh: summary.to_load_kwh,
            from_grid_kwh: summary.from_grid_kwh,
            self_consumption_pct: summary.self_consumption_pct,
            export_pct: summary.export_pct,
            vs_prev: summary.vs_prev,
            previous: summary.previous,
            month_trend: summary.month_trend,
            alerts: summary.alerts,
            comparison_bars: summary.comparison_bars,
          },
          ai_summary: ai.summary,
          model: ai.model,
        };
      }
      return {
        summary: {
          site_id: summary.site_id,
          site_label: summary.site_label,
          station_id: summary.station_id,
          station_name: summary.station_name,
          month: summary.month,
          generated_kwh: summary.generated_kwh,
          consumed_kwh: summary.consumed_kwh,
          exported_kwh: summary.exported_kwh,
          to_load_kwh: summary.to_load_kwh,
          from_grid_kwh: summary.from_grid_kwh,
          self_consumption_pct: summary.self_consumption_pct,
          export_pct: summary.export_pct,
          vs_prev: summary.vs_prev,
          previous: summary.previous,
          month_trend: summary.month_trend,
          alerts: summary.alerts,
          comparison_bars: summary.comparison_bars,
        },
      };
    }

    case "solar_live_get": {
      const { getSolarSite, isSemsConfigured, listSolarSitesPublic } =
        await import("@/lib/sems/config");
      const siteId =
        typeof input.site_id === "string" && input.site_id.trim()
          ? input.site_id.trim()
          : null;
      const site = getSolarSite(siteId);
      if (!site) {
        return {
          configured: isSemsConfigured(),
          sites: listSolarSitesPublic(),
          snapshot: null,
          error: siteId
            ? `Unknown solar site "${siteId}"`
            : "SEMS+ is not configured",
        };
      }

      const { data, error } = await getSolarLiveSnapshot(
        supabase,
        site.stationId,
      );
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
          site_id: site.id,
          site_label: site.label,
          snapshot: null,
          auto_alerts: evaluateSnapshotAlerts(null),
          note: "No live snapshot yet for this site. Sync from the Solar dashboard or wait for cron.",
        };
      }
      return {
        configured: isSemsConfigured(),
        site_id: site.id,
        site_label: site.label,
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
      const [{ data, error }, payments] = await Promise.all([
        listUtilityAccounts(supabase),
        listUtilityPaymentLogs(supabase),
      ]);
      if (error) throw new Error(error.message);
      let rows = data ?? [];
      if (typeof input.utility_type === "string") {
        rows = rows.filter((r) => r.utility_type === input.utility_type);
      }
      rows = rows.filter((r) => isActiveSiteUtilityProvider(r.provider));
      const byAccount = new Map<string, typeof payments.data>();
      for (const p of payments.data ?? []) {
        const list = byAccount.get(p.utility_account_id) ?? [];
        list.push(p);
        byAccount.set(p.utility_account_id, list);
      }
      return rows.map((r) => {
        const last = latestPayment(byAccount.get(r.id) ?? []);
        const nextDue = last ? nextDueFromLastPaid(last.paid_on) : null;
        const known = providerByLabel(r.provider);
        return {
          id: r.id,
          utility_type: r.utility_type,
          /** Exact dashboard label — must match when calling utility_payment_create */
          provider: r.provider,
          dashboard_menu: known?.menuKey ?? null,
          dashboard_site: known?.siteLabel ?? null,
          account_number: r.account_number,
          billing_cycle: r.billing_cycle,
          monthly_avg_cost: r.monthly_avg_cost,
          last_paid_on: last?.paid_on ?? null,
          last_paid_amount: last?.amount ?? null,
          last_units_kwh: last?.units_kwh ?? null,
          last_bill_period: last?.bill_period ?? null,
          last_invoice_number: last?.invoice_number ?? null,
          next_due: nextDue,
          contact_person: r.contact_person,
          notes: r.notes,
        };
      });
    }

    case "tenants_list": {
      const { data, error } = await listTenants(supabase);
      if (error) throw new Error(error.message);
      let rows = data ?? [];
      if (typeof input.name_contains === "string" && input.name_contains.trim()) {
        const q = normalizeKeyPart(input.name_contains);
        rows = rows.filter((r) =>
          normalizeKeyPart(r.tenant_name).includes(q),
        );
      }
      return rows.map((r) => ({
        id: r.id,
        tenant_name: r.tenant_name,
        rent_amount: r.rent_amount,
        rent_due_date: r.rent_due_date,
        payment_status: r.payment_status,
        payment_date: r.payment_date,
        outstanding_amount: r.outstanding_amount,
        notes: r.notes,
      }));
    }

    case "tenants_get": {
      const id = typeof input.id === "string" ? input.id : "";
      const name =
        typeof input.tenant_name === "string" ? input.tenant_name : "";
      let row: Tenant | null = null;
      if (id) {
        const found = await getTenant(supabase, id);
        if (found.error) throw new Error(found.error.message);
        row = found.data;
      } else if (name) {
        row = await findTenantByName(supabase, name);
      } else {
        return { error: "Provide id or tenant_name" };
      }
      if (!row) return { error: "Tenant not found" };
      return row;
    }

    case "tenant_rent_logs_list": {
      const { data: tenants, error: tenantsError } = await listTenants(supabase);
      if (tenantsError) throw new Error(tenantsError.message);
      let tenantId =
        typeof input.tenant_id === "string" ? input.tenant_id : undefined;
      if (!tenantId && typeof input.tenant_name === "string") {
        const match = await findTenantByName(supabase, input.tenant_name);
        tenantId = match?.id;
        if (!tenantId) return { error: "Tenant not found" };
      }
      const { data, error } = await listTenantRentLogs(supabase, tenantId);
      if (error) throw new Error(error.message);
      const names = new Map(
        (tenants ?? []).map((t) => [t.id, t.tenant_name]),
      );
      const limit = clampLimit(input.limit, 40);
      const mapped = (data ?? []).map((r) => ({
        ...r,
        tenant_name: names.get(r.tenant_id) ?? null,
      }));
      return truncatedList(mapped, limit);
    }

    case "tenant_electric_bills_list": {
      const { data: tenants, error: tenantsError } = await listTenants(supabase);
      if (tenantsError) throw new Error(tenantsError.message);
      let tenantId =
        typeof input.tenant_id === "string" ? input.tenant_id : undefined;
      if (!tenantId && typeof input.tenant_name === "string") {
        const match = await findTenantByName(supabase, input.tenant_name);
        tenantId = match?.id;
        if (!tenantId) return { error: "Tenant not found" };
      }
      const { data, error } = await listTenantElectricBills(supabase, tenantId);
      if (error) throw new Error(error.message);
      const names = new Map(
        (tenants ?? []).map((t) => [t.id, t.tenant_name]),
      );
      const limit = clampLimit(input.limit, 40);
      const mapped = (data ?? []).map((r) => ({
        ...r,
        tenant_name: names.get(r.tenant_id) ?? null,
      }));
      return truncatedList(mapped, limit);
    }

    case "chart_of_accounts_list": {
      const ledgerParsed = chartOfAccountsLedgerSchema.safeParse(input.ledger);
      if (!ledgerParsed.success) {
        return {
          error:
            "ledger is required: solar_panel_clifton | eobi | k_electric_gondpass | kwsb_clifton",
        };
      }
      const { data, error } = await listChartOfAccountsEntries(
        supabase,
        ledgerParsed.data,
      );
      if (error) throw new Error(error.message);
      const rows = withRunningBalances(data ?? []);
      const totalDebit = rows.reduce(
        (sum, r) => sum + (Number(r.debit) || 0),
        0,
      );
      const totalCredit = rows.reduce(
        (sum, r) => sum + (Number(r.credit) || 0),
        0,
      );
      const closingBalance =
        rows.length > 0 ? rows[rows.length - 1]!.balance : 0;
      const limit = clampLimit(input.limit, 50);
      // Show newest first in truncated response, but totals cover full ledger
      const newestFirst = [...rows].reverse();
      return truncatedList(newestFirst, limit, {
        ledger: ledgerParsed.data,
        total_debit: totalDebit,
        total_credit: totalCredit,
        closing_balance: closingBalance,
        row_count: rows.length,
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
