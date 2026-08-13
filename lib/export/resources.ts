import type { SupabaseClient } from "@supabase/supabase-js";
import type { CsvColumn } from "@/lib/export/csv";
import { listKitchenInventory } from "@/lib/supabase/kitchen-inventory";
import { listItEquipment } from "@/lib/supabase/it-equipment";
import {
  listGeneratorExpenses,
  listGeneratorFuelLog,
  listGeneratorMaintenance,
} from "@/lib/supabase/generator";
import {
  listSolarMonitoringLog,
  listSolarSpecs,
} from "@/lib/supabase/solar";
import { listUtilityAccounts } from "@/lib/supabase/utilities";
import type {
  GeneratorExpense,
  GeneratorFuelLog,
  GeneratorMaintenance,
  ItEquipment,
  KitchenInventory,
  SolarMonitoringLog,
  SolarSpecs,
  UtilityAccount,
} from "@/lib/types/database";

export const EXPORT_RESOURCES = [
  "kitchen-inventory",
  "it-equipment",
  "generator-maintenance",
  "generator-fuel",
  "generator-expenses",
  "solar-specs",
  "solar-monitoring",
  "utilities",
] as const;

export type ExportResource = (typeof EXPORT_RESOURCES)[number];

export function isExportResource(value: string): value is ExportResource {
  return (EXPORT_RESOURCES as readonly string[]).includes(value);
}

type ExportBundle = {
  title: string;
  filename: string;
  columns: CsvColumn<Record<string, unknown>>[];
  rows: Record<string, unknown>[];
};

function asRows<T extends object>(data: T[] | null): Record<string, unknown>[] {
  return (data ?? []) as unknown as Record<string, unknown>[];
}

function cols<T extends object>(
  columns: CsvColumn<T>[],
): CsvColumn<Record<string, unknown>>[] {
  return columns as unknown as CsvColumn<Record<string, unknown>>[];
}

export async function loadExportBundle(
  supabase: SupabaseClient,
  resource: ExportResource,
): Promise<ExportBundle> {
  switch (resource) {
    case "kitchen-inventory": {
      const { data, error } = await listKitchenInventory(supabase);
      if (error) throw new Error(error.message);
      return {
        title: "Kitchen inventory",
        filename: "kitchen-inventory",
        columns: cols<KitchenInventory>([
          { key: "item_name", header: "Item", value: (r) => r.item_name },
          { key: "category", header: "Category", value: (r) => r.category },
          { key: "unit", header: "Unit", value: (r) => r.unit },
          { key: "current_qty", header: "Current qty", value: (r) => r.current_qty },
          { key: "reorder_level", header: "Reorder level", value: (r) => r.reorder_level },
          { key: "reorder_qty", header: "Reorder qty", value: (r) => r.reorder_qty },
          { key: "supplier", header: "Supplier", value: (r) => r.supplier },
          { key: "cost_per_unit", header: "Cost / unit", value: (r) => r.cost_per_unit },
          { key: "last_restocked_at", header: "Last restocked", value: (r) => r.last_restocked_at },
          { key: "notes", header: "Notes", value: (r) => r.notes },
          { key: "updated_at", header: "Updated", value: (r) => r.updated_at },
        ]),
        rows: asRows(data),
      };
    }
    case "it-equipment": {
      const { data, error } = await listItEquipment(supabase);
      if (error) throw new Error(error.message);
      return {
        title: "IT equipment",
        filename: "it-equipment",
        columns: cols<ItEquipment>([
          { key: "asset_tag", header: "Asset tag", value: (r) => r.asset_tag },
          { key: "item_name", header: "Item", value: (r) => r.item_name },
          { key: "category", header: "Category", value: (r) => r.category },
          { key: "status", header: "Status", value: (r) => r.status },
          { key: "assigned_to", header: "Assigned to", value: (r) => r.assigned_to },
          { key: "serial_number", header: "Serial", value: (r) => r.serial_number },
          { key: "location", header: "Location", value: (r) => r.location },
          { key: "purchase_date", header: "Purchase date", value: (r) => r.purchase_date },
          { key: "warranty_expiry", header: "Warranty expiry", value: (r) => r.warranty_expiry },
          { key: "notes", header: "Notes", value: (r) => r.notes },
          { key: "updated_at", header: "Updated", value: (r) => r.updated_at },
        ]),
        rows: asRows(data),
      };
    }
    case "generator-maintenance": {
      const { data, error } = await listGeneratorMaintenance(supabase);
      if (error) throw new Error(error.message);
      return {
        title: "Generator maintenance",
        filename: "generator-maintenance",
        columns: cols<GeneratorMaintenance>([
          { key: "service_date", header: "Service date", value: (r) => r.service_date },
          { key: "next_service_due", header: "Next due", value: (r) => r.next_service_due },
          { key: "checkup_status", header: "Status", value: (r) => r.checkup_status },
          { key: "service_type", header: "Type", value: (r) => r.service_type },
          { key: "vendor", header: "Vendor", value: (r) => r.vendor },
          { key: "cost", header: "Cost", value: (r) => r.cost },
          { key: "notes", header: "Notes", value: (r) => r.notes },
          { key: "updated_at", header: "Updated", value: (r) => r.updated_at },
        ]),
        rows: asRows(data),
      };
    }
    case "generator-expenses": {
      const { data, error } = await listGeneratorExpenses(supabase);
      if (error) throw new Error(error.message);
      return {
        title: "Generator expenses",
        filename: "generator-expenses",
        columns: cols<GeneratorExpense>([
          { key: "expense_date", header: "Date", value: (r) => r.expense_date },
          { key: "account", header: "Account", value: (r) => r.account },
          { key: "description", header: "Description", value: (r) => r.description },
          { key: "debit", header: "Debit", value: (r) => r.debit },
          { key: "credit", header: "Credit", value: (r) => r.credit },
          { key: "notes", header: "Notes", value: (r) => r.notes },
          { key: "updated_at", header: "Updated", value: (r) => r.updated_at },
        ]),
        rows: asRows(data),
      };
    }
    case "generator-fuel": {
      const { data, error } = await listGeneratorFuelLog(supabase);
      if (error) throw new Error(error.message);
      return {
        title: "Generator fuel log",
        filename: "generator-fuel",
        columns: cols<GeneratorFuelLog>([
          { key: "log_date", header: "Log date", value: (r) => r.log_date },
          { key: "liters_added", header: "Liters added", value: (r) => r.liters_added },
          { key: "running_hours", header: "Running hours", value: (r) => r.running_hours },
          { key: "fuel_level_pct", header: "Fuel %", value: (r) => r.fuel_level_pct },
          { key: "cost", header: "Cost", value: (r) => r.cost },
          { key: "notes", header: "Notes", value: (r) => r.notes },
          { key: "updated_at", header: "Updated", value: (r) => r.updated_at },
        ]),
        rows: asRows(data),
      };
    }
    case "solar-specs": {
      const { data, error } = await listSolarSpecs(supabase);
      if (error) throw new Error(error.message);
      return {
        title: "Solar specs",
        filename: "solar-specs",
        columns: cols<SolarSpecs>([
          { key: "panel_capacity_kw", header: "Panel kW", value: (r) => r.panel_capacity_kw },
          { key: "inverter_model", header: "Inverter", value: (r) => r.inverter_model },
          { key: "battery_capacity_kwh", header: "Battery kWh", value: (r) => r.battery_capacity_kwh },
          { key: "install_date", header: "Install date", value: (r) => r.install_date },
          { key: "vendor", header: "Vendor", value: (r) => r.vendor },
          { key: "warranty_expiry", header: "Warranty", value: (r) => r.warranty_expiry },
          { key: "spec_file_url", header: "Spec file", value: (r) => r.spec_file_url },
          { key: "updated_at", header: "Updated", value: (r) => r.updated_at },
        ]),
        rows: asRows(data),
      };
    }
    case "solar-monitoring": {
      const { data, error } = await listSolarMonitoringLog(supabase);
      if (error) throw new Error(error.message);
      return {
        title: "Solar monitoring",
        filename: "solar-monitoring",
        columns: cols<SolarMonitoringLog>([
          { key: "log_date", header: "Log date", value: (r) => r.log_date },
          { key: "generation_kwh", header: "Generation kWh", value: (r) => r.generation_kwh },
          { key: "consumption_kwh", header: "Consumption kWh", value: (r) => r.consumption_kwh },
          { key: "battery_soc_pct", header: "Battery %", value: (r) => r.battery_soc_pct },
          { key: "alert_flag", header: "Alert", value: (r) => r.alert_flag },
          { key: "notes", header: "Notes", value: (r) => r.notes },
          { key: "updated_at", header: "Updated", value: (r) => r.updated_at },
        ]),
        rows: asRows(data),
      };
    }
    case "utilities": {
      const { data, error } = await listUtilityAccounts(supabase);
      if (error) throw new Error(error.message);
      return {
        title: "Utility accounts",
        filename: "utilities",
        columns: cols<UtilityAccount>([
          { key: "utility_type", header: "Type", value: (r) => r.utility_type },
          { key: "provider", header: "Provider", value: (r) => r.provider },
          { key: "account_number", header: "Account #", value: (r) => r.account_number },
          { key: "billing_cycle", header: "Billing cycle", value: (r) => r.billing_cycle },
          { key: "monthly_avg_cost", header: "Monthly avg", value: (r) => r.monthly_avg_cost },
          { key: "due_date_day", header: "Due day", value: (r) => r.due_date_day },
          { key: "contact_person", header: "Contact", value: (r) => r.contact_person },
          { key: "notes", header: "Notes", value: (r) => r.notes },
          { key: "updated_at", header: "Updated", value: (r) => r.updated_at },
        ]),
        rows: asRows(data),
      };
    }
  }
}
