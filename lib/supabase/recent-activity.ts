import type { SupabaseClient } from "@supabase/supabase-js";
import { applianceSiteHref } from "@/lib/dashboard/appliance-sites";
import { solarSiteDisplayLabel } from "@/lib/sems/sites";

export type RecentActivityItem = {
  id: string;
  domain: "kitchen" | "it" | "appliances" | "generator" | "solar" | "utilities" | "tenants";
  label: string;
  detail: string;
  href: string;
  updated_at: string;
};

function pickUpdated(
  rows: Array<Record<string, unknown>> | null,
  map: (row: Record<string, unknown>) => Omit<RecentActivityItem, "updated_at"> & {
    updated_at?: string;
  },
) {
  return (rows ?? [])
    .map((row) => {
      const mapped = map(row);
      const updated_at =
        mapped.updated_at ??
        (typeof row.updated_at === "string" ? row.updated_at : "");
      if (!updated_at) return null;
      return { ...mapped, updated_at };
    })
    .filter((x): x is RecentActivityItem => Boolean(x));
}

/** Merge recent row updates across domains for the home "history" panel. */
export async function collectRecentActivity(
  supabase: SupabaseClient,
  limit = 12,
): Promise<RecentActivityItem[]> {
  const [
    kitchen,
    it,
    appliances,
    maintenance,
    fuel,
    expenses,
    runs,
    vendors,
    solarSpecs,
    solarLog,
    solarMaint,
    utilities,
    tenants,
  ] =
    await Promise.all([
      supabase
        .from("kitchen_inventory")
        .select("id, item_name, current_qty, unit, updated_at")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("it_equipment")
        .select("id, asset_tag, item_name, status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("appliances")
        .select("id, asset_tag, item_name, status, site, updated_at")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("generator_maintenance")
        .select("id, service_date, service_type, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("generator_fuel_log")
        .select("id, log_date, liters_added, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("generator_expenses")
        .select("id, expense_date, debit, updated_at")
        .order("updated_at", { ascending: false })
        .limit(4),
      supabase
        .from("generator_run_log")
        .select("id, run_date, hours_run, updated_at")
        .order("updated_at", { ascending: false })
        .limit(4),
      supabase
        .from("generator_vendors")
        .select("id, name, phone, updated_at")
        .order("updated_at", { ascending: false })
        .limit(4),
      supabase
        .from("solar_specs")
        .select("id, panel_capacity_kw, inverter_model, updated_at")
        .order("updated_at", { ascending: false })
        .limit(4),
      supabase
        .from("solar_monitoring_log")
        .select("id, log_date, alert_flag, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("solar_maintenance")
        .select("id, site_id, service_date, service_type, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("utility_accounts")
        .select("id, utility_type, provider, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("tenants")
        .select("id, tenant_name, payment_status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6),
    ]);

  const items: RecentActivityItem[] = [
    ...pickUpdated(kitchen.data as Array<Record<string, unknown>> | null, (r) => ({
      id: `kitchen-${r.id}`,
      domain: "kitchen",
      label: String(r.item_name ?? "Kitchen item"),
      detail: `Qty ${r.current_qty ?? "—"}${r.unit ? ` ${r.unit}` : ""}`,
      href: "/dashboard/kitchen-inventory",
    })),
    ...pickUpdated(it.data as Array<Record<string, unknown>> | null, (r) => ({
      id: `it-${r.id}`,
      domain: "it",
      label: `${r.asset_tag} · ${r.item_name}`,
      detail: `Status ${r.status}`,
      href: "/dashboard/it-equipment",
    })),
    ...pickUpdated(appliances.data as Array<Record<string, unknown>> | null, (r) => ({
      id: `appliance-${r.id}`,
      domain: "appliances",
      label: `${r.asset_tag} · ${r.item_name}`,
      detail: `Status ${r.status} · ${r.site === "gondpass_mill" ? "GondPass Mill" : "Clifton Office"}`,
      href: applianceSiteHref(
        r.site === "gondpass_mill" ? "gondpass_mill" : "clifton_office",
      ),
    })),
    ...pickUpdated(
      maintenance.data as Array<Record<string, unknown>> | null,
      (r) => ({
        id: `gen-m-${r.id}`,
        domain: "generator",
        label: "Generator maintenance",
        detail: `${r.service_type ?? "Service"} on ${r.service_date}`,
        href: "/dashboard/generator",
      }),
    ),
    ...pickUpdated(fuel.data as Array<Record<string, unknown>> | null, (r) => ({
      id: `gen-f-${r.id}`,
      domain: "generator",
      label: "Generator fuel log",
      detail: `${r.log_date}${r.liters_added != null ? ` · ${r.liters_added} L` : ""}`,
      href: "/dashboard/generator/fuel",
    })),
    ...pickUpdated(
      expenses.data as Array<Record<string, unknown>> | null,
      (r) => ({
        id: `gen-e-${r.id}`,
        domain: "generator",
        label: "Generator expense",
        detail: `${r.expense_date}${r.debit != null ? ` · debit ${r.debit}` : ""}`,
        href: "/dashboard/generator/expenses",
      }),
    ),
    ...pickUpdated(runs.data as Array<Record<string, unknown>> | null, (r) => ({
      id: `gen-r-${r.id}`,
      domain: "generator",
      label: "Generator run",
      detail: `${r.run_date}${r.hours_run != null ? ` · ${r.hours_run} h` : ""}`,
      href: "/dashboard/generator/runs",
    })),
    ...pickUpdated(
      vendors.data as Array<Record<string, unknown>> | null,
      (r) => ({
        id: `gen-v-${r.id}`,
        domain: "generator",
        label: "Generator vendor",
        detail: `${r.name}${r.phone ? ` · ${r.phone}` : ""}`,
        href: "/dashboard/generator/vendors",
      }),
    ),
    ...pickUpdated(
      solarSpecs.data as Array<Record<string, unknown>> | null,
      (r) => ({
        id: `solar-s-${r.id}`,
        domain: "solar",
        label: "Solar specs",
        detail: [
          r.panel_capacity_kw != null ? `${r.panel_capacity_kw} kW` : null,
          r.inverter_model,
        ]
          .filter(Boolean)
          .join(" · ") || "Specs updated",
        href: "/dashboard/solar",
      }),
    ),
    ...pickUpdated(
      solarLog.data as Array<Record<string, unknown>> | null,
      (r) => ({
        id: `solar-m-${r.id}`,
        domain: "solar",
        label: "Solar monitoring",
        detail: `${r.log_date}${r.alert_flag ? " · alert" : ""}`,
        href: "/dashboard/solar",
      }),
    ),
    ...pickUpdated(
      solarMaint.data as Array<Record<string, unknown>> | null,
      (r) => ({
        id: `solar-svc-${r.id}`,
        domain: "solar",
        label: `Solar service · ${solarSiteDisplayLabel(String(r.site_id ?? ""))}`,
        detail: `${r.service_type ?? "Service"} on ${r.service_date}`,
        href: r.site_id
          ? `/dashboard/solar/service?site=${encodeURIComponent(String(r.site_id))}`
          : "/dashboard/solar/service",
      }),
    ),
    ...pickUpdated(
      utilities.data as Array<Record<string, unknown>> | null,
      (r) => ({
        id: `util-${r.id}`,
        domain: "utilities",
        label: `${r.utility_type} account`,
        detail: String(r.provider ?? "No provider"),
        href: "/dashboard/utilities",
      }),
    ),
    ...pickUpdated(
      tenants.data as Array<Record<string, unknown>> | null,
      (r) => ({
        id: `tenant-${r.id}`,
        domain: "tenants",
        label: String(r.tenant_name ?? "Tenant"),
        detail: `Rent ${r.payment_status ?? "unpaid"}`,
        href: `/dashboard/tenants/${r.id}`,
      }),
    ),
  ];

  return items
    .sort(
      (a, b) =>
        Date.parse(b.updated_at) - Date.parse(a.updated_at),
    )
    .slice(0, limit);
}
