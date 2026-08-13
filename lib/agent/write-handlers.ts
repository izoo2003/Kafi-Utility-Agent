import type { SupabaseClient, User } from "@supabase/supabase-js";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createKitchenInventoryItem,
  deleteKitchenInventoryItem,
  getKitchenInventoryItem,
  kitchenInventoryStatus,
  updateKitchenInventoryItem,
} from "@/lib/supabase/kitchen-inventory";
import {
  createItEquipment,
  deleteItEquipment,
  getItEquipment,
  updateItEquipment,
} from "@/lib/supabase/it-equipment";
import {
  createGeneratorExpense,
  createGeneratorFuelLog,
  createGeneratorMaintenance,
  deleteGeneratorExpense,
  deleteGeneratorFuelLog,
  deleteGeneratorMaintenance,
  updateGeneratorExpense,
  updateGeneratorFuelLog,
  updateGeneratorMaintenance,
} from "@/lib/supabase/generator";
import { withDefaultNextServiceDue } from "@/lib/generator/maintenance";
import { outcomeSummary, type DedupeOutcome } from "@/lib/dashboard/dedupe";

function finalizeCreateSummary(base: string, outcome: DedupeOutcome) {
  if (outcome === "created") return base;
  if (outcome === "updated") {
    return base.replace(/^Create\b/i, "Update duplicate").replace(/\.$/, "") + " (more recent — overwrote existing).";
  }
  return outcomeSummary(outcome, base.replace(/^Create\s+/i, "").replace(/\.$/, ""));
}
import {
  createSolarMonitoringLog,
  createSolarSpecs,
  deleteSolarMonitoringLog,
  deleteSolarSpecs,
  updateSolarMonitoringLog,
  updateSolarSpecs,
} from "@/lib/supabase/solar";
import { removeSolarSpecFile } from "@/lib/supabase/solar-storage";
import {
  createUtilityAccount,
  createUtilityPaymentLog,
  deleteUtilityAccount,
  deleteUtilityPaymentLog,
  getUtilityAccount,
  updateUtilityAccount,
} from "@/lib/supabase/utilities";
import { nextDueFromLastPaid } from "@/lib/utilities/billing";
import { formatDate } from "@/lib/format/datetime";
import type {
  ItEquipment,
  KitchenInventory,
  SolarSpecs,
  UtilityAccount,
} from "@/lib/types/database";
import {
  generatorExpenseCreateSchema,
  generatorExpenseUpdateSchemaAgent,
  generatorFuelCreateSchema,
  generatorFuelUpdateSchemaAgent,
  generatorMaintenanceCreateSchema,
  generatorMaintenanceUpdateSchemaAgent,
  idOnlySchema,
  itCreateSchema,
  itUpdateSchema,
  kitchenCreateSchema,
  kitchenUpdateSchema,
  solarMonitoringCreateSchema,
  solarMonitoringUpdateSchemaAgent,
  solarSpecsCreateSchema,
  solarSpecsUpdateSchemaAgent,
  utilityCreateSchema,
  utilityPaymentCreateSchema,
  utilityUpdateSchemaAgent,
  type WriteToolName,
} from "@/lib/validations/agent-writes";

type Ctx = { supabase: SupabaseClient; user: User };

function zodErrorMessage(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}) {
  return error.issues
    .map((i) => `${i.path.map(String).join(".") || "input"}: ${i.message}`)
    .join("; ");
}

function needsConfirmation(
  tool: WriteToolName,
  summary: string,
  args: Record<string, unknown>,
) {
  const { confirmed: _c, ...rest } = args;
  return {
    status: "needs_confirmation" as const,
    action_summary: summary,
    tool,
    args: rest,
  };
}

function isConfirmed(input: Record<string, unknown>) {
  return input.confirmed === true;
}

function summarizeFields(fields: Record<string, unknown>) {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v === null ? "null" : String(v)}`)
    .join(", ");
}

function stripUndefined<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

async function getGeneratorMaintenance(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase
    .from("generator_maintenance")
    .select("*")
    .eq("id", id)
    .maybeSingle();
}

async function getGeneratorFuelLog(supabase: SupabaseClient, id: string) {
  return supabase
    .from("generator_fuel_log")
    .select("*")
    .eq("id", id)
    .maybeSingle();
}

async function getGeneratorExpense(supabase: SupabaseClient, id: string) {
  return supabase
    .from("generator_expenses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
}

async function getSolarSpecs(supabase: SupabaseClient, id: string) {
  return supabase.from("solar_specs").select("*").eq("id", id).maybeSingle();
}

async function getSolarMonitoring(supabase: SupabaseClient, id: string) {
  return supabase
    .from("solar_monitoring_log")
    .select("*")
    .eq("id", id)
    .maybeSingle();
}

export async function executeWriteTool(
  ctx: Ctx,
  name: WriteToolName,
  input: Record<string, unknown>,
): Promise<unknown> {
  const { supabase, user } = ctx;

  switch (name) {
    case "kitchen_inventory_create": {
      const parsed = kitchenCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const summary = `Create kitchen item "${payload.item_name}" with qty ${payload.current_qty}${payload.unit ? ` ${payload.unit}` : ""} (reorder level ${payload.reorder_level}).`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createKitchenInventoryItem(
        supabase,
        withUpdatedBy({ ...payload }, user),
      );
      if (error) throw new Error(error.message);
      const item = data as KitchenInventory;
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: { ...item, status: kitchenInventoryStatus(item) },
      };
    }

    case "kitchen_inventory_update": {
      const parsed = kitchenUpdateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const existing = await getKitchenInventoryItem(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Kitchen item not found" };
      const item = existing.data as KitchenInventory;
      const summary = `Update kitchen item "${item.item_name}" (${id}): set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id, ...patch });
      }
      const { data, error } = await updateKitchenInventoryItem(
        supabase,
        id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      const updated = data as KitchenInventory;
      return {
        status: "ok",
        summary,
        item: { ...updated, status: kitchenInventoryStatus(updated) },
      };
    }

    case "kitchen_inventory_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getKitchenInventoryItem(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Kitchen item not found" };
      const item = existing.data as KitchenInventory;
      const summary = `DELETE kitchen item "${item.item_name}" (qty ${item.current_qty}${item.unit ? ` ${item.unit}` : ""}). This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteKitchenInventoryItem(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    case "it_equipment_create": {
      const parsed = itCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const summary = `Create IT asset ${payload.asset_tag} ("${payload.item_name}") with status ${payload.status ?? "active"}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createItEquipment(
        supabase,
        withUpdatedBy({ ...payload }, user),
      );
      if (error) throw new Error(error.message);
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: data,
      };
    }

    case "it_equipment_update": {
      const parsed = itUpdateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, asset_tag_lookup, ...fields } = parsed.data;
      let equipment: ItEquipment | null = null;
      if (id) {
        const res = await getItEquipment(supabase, id);
        if (res.error) throw new Error(res.error.message);
        equipment = (res.data as ItEquipment | null) ?? null;
      } else if (asset_tag_lookup) {
        const res = await supabase
          .from("it_equipment")
          .select("*")
          .eq("asset_tag", asset_tag_lookup)
          .maybeSingle();
        if (res.error) throw new Error(res.error.message);
        equipment = (res.data as ItEquipment | null) ?? null;
      }
      if (!equipment) return { error: "IT equipment not found" };
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const summary = `Update IT asset ${equipment.asset_tag} ("${equipment.item_name}"): set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, {
          id: equipment.id,
          ...patch,
        });
      }
      const { data, error } = await updateItEquipment(
        supabase,
        equipment.id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "it_equipment_delete": {
      let equipment: ItEquipment | null = null;
      if (typeof input.id === "string" && input.id) {
        const idParse = idOnlySchema.safeParse(input);
        if (!idParse.success) return { error: zodErrorMessage(idParse.error) };
        const res = await getItEquipment(supabase, idParse.data.id);
        if (res.error) throw new Error(res.error.message);
        equipment = (res.data as ItEquipment | null) ?? null;
      } else if (typeof input.asset_tag === "string" && input.asset_tag) {
        const res = await supabase
          .from("it_equipment")
          .select("*")
          .eq("asset_tag", input.asset_tag)
          .maybeSingle();
        if (res.error) throw new Error(res.error.message);
        equipment = (res.data as ItEquipment | null) ?? null;
      } else {
        return { error: "Provide id or asset_tag" };
      }
      if (!equipment) return { error: "IT equipment not found" };
      const summary = `DELETE IT asset ${equipment.asset_tag} ("${equipment.item_name}"). This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id: equipment.id });
      }
      const { error } = await deleteItEquipment(supabase, equipment.id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: equipment.id };
    }

    case "generator_maintenance_create": {
      const parsed = generatorMaintenanceCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = withDefaultNextServiceDue({
        ...parsed.data,
        checkup_status: parsed.data.checkup_status ?? "done",
      });
      const summary = `Create generator maintenance on ${payload.service_date}${payload.service_type ? ` (${payload.service_type})` : ""}, status ${payload.checkup_status}${payload.next_service_due ? `, next due ${payload.next_service_due}` : " (next due +1 month)"}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createGeneratorMaintenance(
        supabase,
        withUpdatedBy({ ...payload }, user),
      );
      if (error) throw new Error(error.message);
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: data,
      };
    }

    case "generator_maintenance_update": {
      const parsed = generatorMaintenanceUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const existing = await getGeneratorMaintenance(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Maintenance record not found" };
      const summary = `Update generator maintenance ${id} (service ${existing.data.service_date}): set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id, ...patch });
      }
      const { data, error } = await updateGeneratorMaintenance(
        supabase,
        id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "generator_maintenance_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getGeneratorMaintenance(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Maintenance record not found" };
      const summary = `DELETE generator maintenance on ${existing.data.service_date}${existing.data.service_type ? ` (${existing.data.service_type})` : ""}. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteGeneratorMaintenance(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    case "generator_fuel_log_create": {
      const parsed = generatorFuelCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const summary = [
        `Create generator fuel log for ${payload.log_date}`,
        payload.liters_added != null ? `${payload.liters_added} L` : null,
        payload.running_hours != null ? `${payload.running_hours} hrs` : null,
        payload.fuel_level_pct != null ? `level ${payload.fuel_level_pct}%` : null,
        payload.cost != null ? `cost ${payload.cost}` : null,
      ]
        .filter(Boolean)
        .join(" — ");
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createGeneratorFuelLog(
        supabase,
        withUpdatedBy({ ...payload }, user),
      );
      if (error) throw new Error(error.message);
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: data,
      };
    }

    case "generator_fuel_log_update": {
      const parsed = generatorFuelUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const existing = await getGeneratorFuelLog(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Fuel log not found" };
      const summary = `Update generator fuel log ${id} (${existing.data.log_date}): set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id, ...patch });
      }
      const { data, error } = await updateGeneratorFuelLog(
        supabase,
        id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "generator_fuel_log_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getGeneratorFuelLog(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Fuel log not found" };
      const summary = `DELETE generator fuel log for ${existing.data.log_date}${existing.data.liters_added != null ? ` (${existing.data.liters_added} L)` : ""}. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteGeneratorFuelLog(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    case "generator_expense_create": {
      const parsed = generatorExpenseCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const summary = `Create generator expense on ${payload.expense_date}${payload.account ? ` — ${payload.account}` : ""}${payload.description ? `: ${payload.description}` : ""}, debit ${payload.debit}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createGeneratorExpense(
        supabase,
        withUpdatedBy({ ...payload }, user),
      );
      if (error) throw new Error(error.message);
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: data,
      };
    }

    case "generator_expense_update": {
      const parsed = generatorExpenseUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const existing = await getGeneratorExpense(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Expense record not found" };
      const summary = `Update generator expense ${id} (${existing.data.expense_date}): set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id, ...patch });
      }
      const { data, error } = await updateGeneratorExpense(
        supabase,
        id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "generator_expense_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getGeneratorExpense(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Expense record not found" };
      const summary = `DELETE generator expense on ${existing.data.expense_date} (debit ${existing.data.debit}). This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteGeneratorExpense(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    case "solar_specs_create": {
      const parsed = solarSpecsCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const summary = `Create solar specs record${payload.panel_capacity_kw != null ? ` (${payload.panel_capacity_kw} kW panels)` : ""}${payload.inverter_model ? `, inverter ${payload.inverter_model}` : ""}. Spec file upload stays on the dashboard.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createSolarSpecs(
        supabase,
        withUpdatedBy({ ...payload }, user),
      );
      if (error) throw new Error(error.message);
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: data,
      };
    }

    case "solar_specs_update": {
      const parsed = solarSpecsUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const existing = await getSolarSpecs(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Solar specs not found" };
      const summary = `Update solar specs ${id}: set ${summarizeFields(patch)}. Spec file upload stays on the dashboard.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id, ...patch });
      }
      const { data, error } = await updateSolarSpecs(
        supabase,
        id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "solar_specs_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getSolarSpecs(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Solar specs not found" };
      const specs = existing.data as SolarSpecs;
      const summary = `DELETE solar specs record ${id}${specs.panel_capacity_kw != null ? ` (${specs.panel_capacity_kw} kW)` : ""}${specs.spec_file_url ? " and its uploaded file" : ""}. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      if (specs.spec_file_url) {
        await removeSolarSpecFile(supabase, specs.spec_file_url);
      }
      const { error } = await deleteSolarSpecs(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    case "solar_monitoring_create": {
      const parsed = solarMonitoringCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const summary = `Create solar monitoring log for ${payload.log_date}${payload.generation_kwh != null ? ` — generation ${payload.generation_kwh} kWh` : ""}${payload.alert_flag ? " (ALERT)" : ""}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createSolarMonitoringLog(
        supabase,
        withUpdatedBy({ ...payload }, user),
      );
      if (error) throw new Error(error.message);
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: data,
      };
    }

    case "solar_monitoring_update": {
      const parsed = solarMonitoringUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const existing = await getSolarMonitoring(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Solar monitoring log not found" };
      const summary = `Update solar monitoring ${id} (${existing.data.log_date}): set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id, ...patch });
      }
      const { data, error } = await updateSolarMonitoringLog(
        supabase,
        id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "solar_monitoring_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getSolarMonitoring(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Solar monitoring log not found" };
      const summary = `DELETE solar monitoring log for ${existing.data.log_date}. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteSolarMonitoringLog(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    case "utility_accounts_create": {
      const parsed = utilityCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const summary = `Create ${payload.utility_type} utility account${payload.provider ? ` (${payload.provider})` : ""}. Never store passwords.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createUtilityAccount(
        supabase,
        withUpdatedBy({ ...payload }, user),
      );
      if (error) throw new Error(error.message);
      const row = data as UtilityAccount;
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: {
          id: row.id,
          utility_type: row.utility_type,
          provider: row.provider,
          account_number: row.account_number,
          billing_cycle: row.billing_cycle,
          monthly_avg_cost: row.monthly_avg_cost,
          due_date_day: row.due_date_day,
          contact_person: row.contact_person,
          notes: row.notes,
        },
      };
    }

    case "utility_accounts_update": {
      const parsed = utilityUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const existing = await getUtilityAccount(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Utility account not found" };
      const row = existing.data as UtilityAccount;
      const summary = `Update ${row.utility_type} utility account (${row.provider ?? "no provider"}): set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id, ...patch });
      }
      const { data, error } = await updateUtilityAccount(
        supabase,
        id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return {
        status: "ok",
        summary,
        item: data
          ? {
              id: data.id,
              utility_type: data.utility_type,
              provider: data.provider,
              account_number: data.account_number,
              billing_cycle: data.billing_cycle,
              monthly_avg_cost: data.monthly_avg_cost,
              due_date_day: data.due_date_day,
              contact_person: data.contact_person,
              notes: data.notes,
            }
          : null,
      };
    }

    case "utility_accounts_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getUtilityAccount(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Utility account not found" };
      const row = existing.data as UtilityAccount;
      const summary = `DELETE ${row.utility_type} utility account (${row.provider ?? "no provider"}). This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteUtilityAccount(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    case "utility_payment_create": {
      const parsed = utilityPaymentCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const account = await getUtilityAccount(
        supabase,
        payload.utility_account_id,
      );
      if (account.error) throw new Error(account.error.message);
      if (!account.data) return { error: "Utility account not found" };
      const acct = account.data as UtilityAccount;
      const label = acct.provider ?? acct.utility_type;
      const nextDue = nextDueFromLastPaid(payload.paid_on);
      const summary = `Log ${label} payment on ${formatDate(payload.paid_on)}${payload.amount != null ? ` — amount ${payload.amount}` : ""}. Next due ${formatDate(nextDue)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createUtilityPaymentLog(
        supabase,
        withUpdatedBy({ ...payload }, user),
      );
      if (error) throw new Error(error.message);
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: data,
        next_due: nextDue,
      };
    }

    case "utility_payment_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const summary = `DELETE utility payment log ${id}. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteUtilityPaymentLog(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    default:
      throw new Error(`Unknown write tool: ${name}`);
  }
}
