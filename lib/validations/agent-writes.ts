import { z } from "zod";
import { optionalDate } from "@/lib/validations/helpers";
import {
  kitchenInventoryInsertSchema,
  kitchenInventoryUpdateSchema,
} from "@/lib/validations/kitchen-inventory";
import {
  itEquipmentInsertSchema,
  itEquipmentUpdateSchema,
} from "@/lib/validations/it-equipment";
import {
  applianceInsertSchema,
  applianceSiteSchema,
  applianceUpdateSchema,
} from "@/lib/validations/appliances";
import {
  generatorExpenseInsertSchema,
  generatorExpenseUpdateSchema,
  generatorFuelLogInsertSchema,
  generatorFuelLogUpdateSchema,
  generatorMaintenanceInsertSchema,
  generatorMaintenanceUpdateSchema,
  generatorRunLogInsertSchema,
  generatorRunLogUpdateSchema,
  generatorVendorInsertSchema,
  generatorVendorUpdateSchema,
} from "@/lib/validations/generator";
import {
  solarMaintenanceInsertSchema,
  solarMaintenanceUpdateSchema,
  solarMonitoringLogInsertSchema,
  solarMonitoringLogUpdateSchema,
  solarSpecsInsertSchema,
  solarSpecsUpdateSchema,
} from "@/lib/validations/solar";
import {
  utilityAccountInsertSchema,
  utilityAccountUpdateSchema,
  utilityPaymentLogInsertSchema,
} from "@/lib/validations/utilities";
import {
  tenantElectricBillInsertSchema,
  tenantElectricBillUpdateSchema,
  tenantInsertSchema,
  tenantRentPaymentInsertSchema,
  tenantUpdateSchema,
} from "@/lib/validations/tenants";
import {
  chartOfAccountsEntryInsertSchema,
  chartOfAccountsEntryUpdateSchema,
} from "@/lib/validations/chart-of-accounts";

export const WRITE_TOOL_NAMES = [
  "kitchen_inventory_create",
  "kitchen_inventory_update",
  "kitchen_inventory_adjust_qty",
  "kitchen_inventory_delete",
  "it_equipment_create",
  "it_equipment_update",
  "it_equipment_delete",
  "appliances_create",
  "appliances_update",
  "appliances_delete",
  "generator_maintenance_create",
  "generator_maintenance_update",
  "generator_maintenance_delete",
  "generator_fuel_log_create",
  "generator_fuel_log_update",
  "generator_fuel_log_delete",
  "generator_expense_create",
  "generator_expense_update",
  "generator_expense_delete",
  "generator_run_log_create",
  "generator_run_log_update",
  "generator_run_log_delete",
  "generator_vendors_create",
  "generator_vendors_update",
  "generator_vendors_delete",
  "solar_specs_create",
  "solar_specs_update",
  "solar_specs_delete",
  "solar_monitoring_create",
  "solar_monitoring_update",
  "solar_monitoring_delete",
  "solar_maintenance_create",
  "solar_maintenance_update",
  "solar_maintenance_delete",
  "utility_accounts_create",
  "utility_accounts_update",
  "utility_accounts_delete",
  "utility_payment_create",
  "utility_payment_delete",
  "tenants_create",
  "tenants_update",
  "tenants_delete",
  "tenant_rent_payment_create",
  "tenant_electric_bill_create",
  "tenant_electric_bill_update",
  "tenant_electric_bill_delete",
  "chart_of_accounts_entry_create",
  "chart_of_accounts_entry_update",
  "chart_of_accounts_entry_delete",
] as const;

export type WriteToolName = (typeof WRITE_TOOL_NAMES)[number];

export const writeToolNameSchema = z.enum(WRITE_TOOL_NAMES);

export const idOnlySchema = z.object({
  id: z.string().uuid(),
});

export const kitchenCreateSchema = kitchenInventoryInsertSchema;
export const kitchenUpdateSchema = kitchenInventoryUpdateSchema.required({
  id: true,
});
export const kitchenAdjustQtySchema = z.object({
  id: z.string().uuid(),
  delta: z.number().refine((n) => n !== 0, "delta must be non-zero"),
  notes: z.string().trim().min(1).optional().nullable(),
});

export const itCreateSchema = itEquipmentInsertSchema;
export const itUpdateSchema = itEquipmentUpdateSchema
  .extend({
    asset_tag_lookup: z.string().trim().min(1).optional(),
  })
  .refine((v) => Boolean(v.id || v.asset_tag_lookup), {
    message: "Provide id or asset_tag_lookup to find the row",
  });

export const applianceCreateSchema = applianceInsertSchema;
export const applianceUpdateSchemaAgent = applianceUpdateSchema
  .extend({
    asset_tag_lookup: z.string().trim().min(1).optional(),
    site_lookup: applianceSiteSchema.optional(),
  })
  .refine((v) => Boolean(v.id || v.asset_tag_lookup), {
    message: "Provide id or asset_tag_lookup to find the row",
  });

export const generatorMaintenanceCreateSchema =
  generatorMaintenanceInsertSchema;
export const generatorMaintenanceUpdateSchemaAgent =
  generatorMaintenanceUpdateSchema.required({ id: true });

/** Accept common sheet/header aliases from OCR / Gemini before Zod field checks. */
function withFuelFieldAliases(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      if (o[key] !== undefined && o[key] !== null && o[key] !== "") {
        return o[key];
      }
    }
    return undefined;
  };

  if (o.liters_added == null || o.liters_added === "") {
    const v = pick(
      "litres_added",
      "litres",
      "liters",
      "litre",
      "liter",
      "fuel_litres",
      "fuel_liters",
      "qty_l",
      "quantity_l",
      "ltrs",
      "L",
    );
    if (v !== undefined) o.liters_added = v;
  }
  if (o.running_hours == null || o.running_hours === "") {
    const v = pick(
      "hours",
      "hrs",
      "running_hrs",
      "run_hours",
      "hour_meter",
      "hmr",
      "engine_hours",
      "gen_hours",
    );
    if (v !== undefined) o.running_hours = v;
  }
  if (o.fuel_level_pct == null || o.fuel_level_pct === "") {
    const v = pick(
      "fuel_level",
      "level_pct",
      "level",
      "fuel_pct",
      "tank_level",
      "tank_pct",
      "fuel_level_percent",
    );
    if (v !== undefined) o.fuel_level_pct = v;
  }
  if (o.cost == null || o.cost === "") {
    const v = pick("amount", "debit", "price", "total", "fuel_cost");
    if (v !== undefined) o.cost = v;
  }
  return o;
}

export const generatorFuelCreateSchema = z.preprocess(
  withFuelFieldAliases,
  generatorFuelLogInsertSchema,
);
export const generatorFuelUpdateSchemaAgent = z.preprocess(
  withFuelFieldAliases,
  generatorFuelLogUpdateSchema.required({ id: true }),
);

export const generatorExpenseCreateSchema = generatorExpenseInsertSchema;
export const generatorExpenseUpdateSchemaAgent =
  generatorExpenseUpdateSchema.required({ id: true });

export const generatorRunLogCreateSchema = generatorRunLogInsertSchema;
export const generatorRunLogUpdateSchemaAgent =
  generatorRunLogUpdateSchema.required({ id: true });

export const generatorVendorCreateSchema = generatorVendorInsertSchema;
export const generatorVendorUpdateSchemaAgent = generatorVendorUpdateSchema
  .extend({
    name_lookup: z.string().trim().min(1).optional(),
  })
  .refine((v) => Boolean(v.id || v.name_lookup), {
    message: "Provide id or name_lookup to find the vendor",
  });

export const generatorVendorDeleteSchema = z
  .object({
    id: z.string().uuid().optional(),
    name_lookup: z.string().trim().min(1).optional(),
  })
  .refine((v) => Boolean(v.id || v.name_lookup), {
    message: "Provide id or name_lookup to find the vendor",
  });

/** Chat cannot set/upload spec files — dashboard only */
export const solarSpecsCreateSchema = solarSpecsInsertSchema.omit({
  spec_file_url: true,
});
export const solarSpecsUpdateSchemaAgent = solarSpecsUpdateSchema
  .omit({ spec_file_url: true })
  .required({ id: true });

export const solarMonitoringCreateSchema = solarMonitoringLogInsertSchema;
export const solarMonitoringUpdateSchemaAgent =
  solarMonitoringLogUpdateSchema.required({ id: true });

export const solarMaintenanceCreateSchema = solarMaintenanceInsertSchema;
export const solarMaintenanceUpdateSchemaAgent =
  solarMaintenanceUpdateSchema.required({ id: true });

export const utilityCreateSchema = utilityAccountInsertSchema;
export const utilityUpdateSchemaAgent = utilityAccountUpdateSchema.required({
  id: true,
});

/** Chat cannot set/upload bill PDFs — dashboard upload or seed script */
export const utilityPaymentCreateSchema = utilityPaymentLogInsertSchema.omit({
  bill_file_url: true,
});
export const utilityPaymentDeleteSchema = idOnlySchema;

export const tenantCreateSchema = tenantInsertSchema.extend({
  attach_agreement: z.boolean().optional(),
  agreement_attachment_index: z.number().int().min(0).max(7).optional(),
});
export const tenantUpdateSchemaAgent = tenantUpdateSchema
  .extend({
    tenant_name_lookup: z.string().trim().min(1).optional(),
    attach_agreement: z.boolean().optional(),
    clear_agreement_file: z.boolean().optional(),
    agreement_attachment_index: z.number().int().min(0).max(7).optional(),
  })
  .refine((v) => Boolean(v.id || v.tenant_name_lookup), {
    message: "Provide id or tenant_name_lookup to find the tenant",
  });

export const tenantDeleteSchema = z
  .object({
    id: z.string().uuid().optional(),
    tenant_name_lookup: z.string().trim().min(1).optional(),
  })
  .refine((v) => Boolean(v.id || v.tenant_name_lookup), {
    message: "Provide id or tenant_name_lookup to find the tenant",
  });

const tenantRef = {
  tenant_id: z.string().uuid().optional(),
  tenant_name: z.string().trim().min(1).optional(),
};

export const tenantRentPaymentCreateSchema = tenantRentPaymentInsertSchema
  .omit({ schedule_id: true })
  .extend({
    schedule_id: z.string().uuid().optional(),
    ...tenantRef,
    month_date: optionalDate,
    attach_payment: z.boolean().optional(),
    payment_attachment_index: z.number().int().min(0).max(7).optional(),
  })
  .refine((v) => Boolean(v.schedule_id || v.tenant_id || v.tenant_name), {
    message: "Provide schedule_id, tenant_id, or tenant_name",
  });

export const tenantElectricBillCreateSchema = tenantElectricBillInsertSchema
  .omit({ tenant_id: true })
  .extend(tenantRef)
  .refine((v) => Boolean(v.tenant_id || v.tenant_name), {
    message: "Provide tenant_id or tenant_name",
  });
export const tenantElectricBillUpdateSchemaAgent =
  tenantElectricBillUpdateSchema.required({ id: true });

export const chartOfAccountsEntryCreateSchema = chartOfAccountsEntryInsertSchema;
export const chartOfAccountsEntryUpdateSchemaAgent =
  chartOfAccountsEntryUpdateSchema.required({ id: true });
