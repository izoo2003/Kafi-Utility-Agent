import type { SupabaseClient, User } from "@supabase/supabase-js";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  adjustKitchenInventoryQty,
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
  createAppliance,
  deleteAppliance,
  findAppliancesByAssetTag,
  getAppliance,
  updateAppliance,
} from "@/lib/supabase/appliances";
import {
  createGeneratorExpense,
  createGeneratorFuelLog,
  createGeneratorMaintenance,
  createGeneratorRunLog,
  createGeneratorVendor,
  deleteGeneratorExpense,
  deleteGeneratorFuelLog,
  deleteGeneratorMaintenance,
  deleteGeneratorRunLog,
  deleteGeneratorVendor,
  findGeneratorVendorByName,
  getGeneratorRunLog,
  getGeneratorVendor,
  updateGeneratorExpense,
  updateGeneratorFuelLog,
  updateGeneratorMaintenance,
  updateGeneratorRunLog,
  updateGeneratorVendor,
} from "@/lib/supabase/generator";
import { withDefaultNextServiceDue } from "@/lib/generator/maintenance";
import { findSolarSite, listSolarSites, solarSiteDisplayLabel } from "@/lib/sems/sites";
import { outcomeSummary, type DedupeOutcome } from "@/lib/dashboard/dedupe";
import { agentWriteTools } from "@/lib/agent/write-tools";

function finalizeCreateSummary(base: string, outcome: DedupeOutcome) {
  if (outcome === "created") return base;
  if (outcome === "updated") {
    return base.replace(/^Create\b/i, "Update duplicate").replace(/\.$/, "") + " (more recent — overwrote existing).";
  }
  return outcomeSummary(outcome, base.replace(/^Create\s+/i, "").replace(/\.$/, ""));
}

const writeToolPropsByTool = new Map(
  agentWriteTools.map((tool) => [
    tool.name,
    Object.keys(tool.parameters?.properties ?? {}),
  ]),
);

/**
 * Gemini omits properties it couldn't read from an attachment. Zod v4 rejects
 * a MISSING key on any field that isn't declared `.optional()` — even when the
 * field's own schema accepts `undefined` — so an omitted optional field fails
 * with "expected nonoptional, received undefined" and the whole import dies.
 * Materialize the tool's declared properties as `undefined` so optional fields
 * validate (truly required fields still fail, as they should).
 */
function normalizeOmittedToolArgs(
  name: WriteToolName,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const props = writeToolPropsByTool.get(name);
  if (!props?.length) return input;
  const next = { ...input };
  for (const key of props) {
    if (!(key in next)) next[key] = undefined;
  }
  return next;
}
import {
  createSolarMaintenance,
  createSolarMonitoringLog,
  createSolarSpecs,
  deleteSolarMaintenance,
  deleteSolarMonitoringLog,
  deleteSolarSpecs,
  updateSolarMaintenance,
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
import {
  createTenant,
  createTenantElectricBill,
  createTenantRentPayment,
  deleteTenant,
  deleteTenantElectricBill,
  findScheduleByPeriod,
  findTenantByName,
  getTenant,
  getTenantElectricBill,
  getTenantScheduleRow,
  updateTenant,
  updateTenantElectricBill,
} from "@/lib/supabase/tenants";
import {
  clearElectricBillFile,
  clearTenantAgreementFile,
  setElectricBillFile,
  setRentPaymentFile,
  setTenantAgreementFile,
  type ChatFilePayload,
} from "@/lib/supabase/tenant-documents";
import {
  createChartOfAccountsEntry,
  deleteChartOfAccountsEntry,
  getChartOfAccountsEntry,
  updateChartOfAccountsEntry,
} from "@/lib/supabase/chart-of-accounts";
import { chartOfAccountsSectionMeta } from "@/lib/dashboard/chart-of-accounts-sections";
import { nextDueFromLastPaid } from "@/lib/utilities/billing";
import { formatDate } from "@/lib/format/datetime";
import type {
  Appliance,
  ApplianceSite,
  ItEquipment,
  KitchenInventory,
  SolarSpecs,
  Tenant,
  UtilityAccount,
} from "@/lib/types/database";
import {
  generatorExpenseCreateSchema,
  generatorExpenseUpdateSchemaAgent,
  generatorFuelCreateSchema,
  generatorFuelUpdateSchemaAgent,
  generatorMaintenanceCreateSchema,
  generatorMaintenanceUpdateSchemaAgent,
  generatorRunLogCreateSchema,
  generatorRunLogUpdateSchemaAgent,
  generatorVendorCreateSchema,
  generatorVendorDeleteSchema,
  generatorVendorUpdateSchemaAgent,
  idOnlySchema,
  itCreateSchema,
  itUpdateSchema,
  applianceCreateSchema,
  applianceUpdateSchemaAgent,
  kitchenCreateSchema,
  kitchenUpdateSchema,
  kitchenAdjustQtySchema,
  solarMaintenanceCreateSchema,
  solarMaintenanceUpdateSchemaAgent,
  solarMonitoringCreateSchema,
  solarMonitoringUpdateSchemaAgent,
  solarSpecsCreateSchema,
  solarSpecsUpdateSchemaAgent,
  tenantCreateSchema,
  tenantDeleteSchema,
  tenantElectricBillCreateSchema,
  tenantElectricBillUpdateSchemaAgent,
  tenantRentPaymentCreateSchema,
  tenantUpdateSchemaAgent,
  utilityCreateSchema,
  utilityPaymentCreateSchema,
  utilityUpdateSchemaAgent,
  chartOfAccountsEntryCreateSchema,
  chartOfAccountsEntryUpdateSchemaAgent,
  type WriteToolName,
} from "@/lib/validations/agent-writes";

type Ctx = {
  supabase: SupabaseClient;
  user: User;
  attachments?: Array<{ mimeType: string; data: string; name?: string }>;
};

async function resolveApplianceByTag(
  supabase: SupabaseClient,
  assetTag: string,
  site?: ApplianceSite | null,
): Promise<{ appliance: Appliance | null; error?: string }> {
  const { data, error } = await findAppliancesByAssetTag(
    supabase,
    assetTag,
    site,
  );
  if (error) throw new Error(error);
  if (data.length === 0) return { appliance: null };
  if (data.length > 1) {
    return {
      appliance: null,
      error:
        "Multiple appliances match that asset tag. Provide site: clifton_office or gondpass_mill.",
    };
  }
  return { appliance: data[0] };
}

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
    .filter(([k, v]) => v !== undefined && !k.startsWith("_"))
    .map(([k, v]) => `${k}=${v === null ? "null" : String(v)}`)
    .join(", ");
}

function stripUndefined<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

type ChatFile = ChatFilePayload;

function asChatFile(value: unknown): ChatFile | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (typeof o.data !== "string" || typeof o.mimeType !== "string") return null;
  return {
    mimeType: o.mimeType,
    data: o.data,
    name: typeof o.name === "string" ? o.name : undefined,
  };
}

function pickChatAttachment(
  ctx: Ctx,
  index: unknown,
  fallback: number,
): ChatFile | null {
  const files = ctx.attachments ?? [];
  if (!files.length) return null;
  const n = typeof index === "number" && Number.isFinite(index) ? index : fallback;
  const picked = files[n] ?? files[0];
  return picked ?? null;
}

function injectTenantChatFiles(
  args: Record<string, unknown>,
  input: Record<string, unknown>,
  ctx: Ctx,
): Record<string, unknown> {
  const next = { ...args };
  if (input.attach_agreement === true) {
    const existing = asChatFile(input._agreement_file);
    const picked =
      existing ??
      pickChatAttachment(ctx, input.agreement_attachment_index, 0);
    if (picked) next._agreement_file = picked;
  }
  if (input.attach_payment === true) {
    const existing = asChatFile(input._payment_file);
    const defaultIdx = input.attach_agreement === true ? 1 : 0;
    const picked =
      existing ??
      pickChatAttachment(ctx, input.payment_attachment_index, defaultIdx);
    if (picked) next._payment_file = picked;
  }
  if (input.attach_bill === true) {
    const existing = asChatFile(input._bill_file);
    const defaultIdx =
      (input.attach_agreement === true ? 1 : 0) +
      (input.attach_payment === true ? 1 : 0);
    const picked =
      existing ??
      pickChatAttachment(ctx, input.bill_attachment_index, defaultIdx);
    if (picked) next._bill_file = picked;
  }
  return next;
}

const TENANT_FILE_FLAG_KEYS = [
  "attach_agreement",
  "attach_payment",
  "attach_bill",
  "clear_agreement_file",
  "clear_payment_file",
  "clear_bill_file",
  "agreement_attachment_index",
  "payment_attachment_index",
  "bill_attachment_index",
] as const;

function omitTenantFileFlags<T extends Record<string, unknown>>(obj: T) {
  const next = { ...obj };
  for (const key of TENANT_FILE_FLAG_KEYS) delete next[key];
  delete next._agreement_file;
  delete next._payment_file;
  delete next._bill_file;
  return next;
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

async function getSolarMaintenance(supabase: SupabaseClient, id: string) {
  return supabase
    .from("solar_maintenance")
    .select("*")
    .eq("id", id)
    .maybeSingle();
}

function resolveSolarPlant(raw?: string | null):
  | { id: string; label: string }
  | { error: string } {
  const sites = listSolarSites();
  if (!sites.length) return { error: "No solar plants configured" };
  if (!raw?.trim()) {
    if (sites.length === 1) {
      return { id: sites[0]!.id, label: sites[0]!.label };
    }
    return {
      error:
        "Provide site_id: Good We Office, Sungrow Office, or KMP Home Solar",
    };
  }
  const site = findSolarSite(raw);
  if (!site) return { error: `Unknown solar plant "${raw.trim()}"` };
  return { id: site.id, label: site.label };
}

export async function executeWriteTool(
  ctx: Ctx,
  name: WriteToolName,
  input: Record<string, unknown>,
): Promise<unknown> {
  const { supabase, user } = ctx;
  input = normalizeOmittedToolArgs(name, input);

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

    case "kitchen_inventory_adjust_qty": {
      const parsed = kitchenAdjustQtySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, delta, notes } = parsed.data;
      const existing = await getKitchenInventoryItem(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Kitchen item not found" };
      const item = existing.data as KitchenInventory;
      const before = Number(item.current_qty) || 0;
      const after = Math.max(0, before + delta);
      const action = delta > 0 ? "Refill" : "Use";
      const summary = `${action} kitchen "${item.item_name}": ${before}${item.unit ? ` ${item.unit}` : ""} → ${after}${item.unit ? ` ${item.unit}` : ""} (delta ${delta > 0 ? "+" : ""}${delta}).`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, {
          id,
          delta,
          ...(notes != null ? { notes } : {}),
        });
      }
      const { data, error } = await adjustKitchenInventoryQty(
        supabase,
        id,
        delta,
        notes ?? null,
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

    case "appliances_create": {
      const parsed = applianceCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const siteLabel =
        payload.site === "gondpass_mill" ? "GondPass Mill" : "Clifton Office";
      const summary = `Create appliance ${payload.asset_tag} ("${payload.item_name}") at ${siteLabel} with status ${payload.status ?? "active"}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createAppliance(
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

    case "appliances_update": {
      const parsed = applianceUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, asset_tag_lookup, site_lookup, ...fields } = parsed.data;
      let appliance: Appliance | null = null;
      if (id) {
        const res = await getAppliance(supabase, id);
        if (res.error) throw new Error(res.error.message);
        appliance = (res.data as Appliance | null) ?? null;
      } else if (asset_tag_lookup) {
        const found = await resolveApplianceByTag(
          supabase,
          asset_tag_lookup,
          site_lookup ?? null,
        );
        if (found.error) return { error: found.error };
        appliance = found.appliance;
      }
      if (!appliance) return { error: "Appliance not found" };
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const siteLabel =
        appliance.site === "gondpass_mill" ? "GondPass Mill" : "Clifton Office";
      const summary = `Update appliance ${appliance.asset_tag} ("${appliance.item_name}") at ${siteLabel}: set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, {
          id: appliance.id,
          ...patch,
        });
      }
      const { data, error } = await updateAppliance(
        supabase,
        appliance.id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "appliances_delete": {
      let appliance: Appliance | null = null;
      if (typeof input.id === "string" && input.id) {
        const idParse = idOnlySchema.safeParse(input);
        if (!idParse.success) return { error: zodErrorMessage(idParse.error) };
        const res = await getAppliance(supabase, idParse.data.id);
        if (res.error) throw new Error(res.error.message);
        appliance = (res.data as Appliance | null) ?? null;
      } else if (typeof input.asset_tag === "string" && input.asset_tag) {
        const site =
          input.site === "clifton_office" || input.site === "gondpass_mill"
            ? (input.site as ApplianceSite)
            : null;
        const found = await resolveApplianceByTag(
          supabase,
          input.asset_tag,
          site,
        );
        if (found.error) return { error: found.error };
        appliance = found.appliance;
      } else {
        return { error: "Provide id or asset_tag" };
      }
      if (!appliance) return { error: "Appliance not found" };
      const siteLabel =
        appliance.site === "gondpass_mill" ? "GondPass Mill" : "Clifton Office";
      const summary = `DELETE appliance ${appliance.asset_tag} ("${appliance.item_name}") at ${siteLabel}. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id: appliance.id });
      }
      const { error } = await deleteAppliance(supabase, appliance.id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: appliance.id };
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

    case "generator_run_log_create": {
      const parsed = generatorRunLogCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const summary = `Log generator outage run on ${payload.run_date} for ${payload.hours_run} hours${payload.notes ? ` (${payload.notes})` : ""}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createGeneratorRunLog(
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

    case "generator_run_log_update": {
      const parsed = generatorRunLogUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const existing = await getGeneratorRunLog(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Run log not found" };
      const summary = `Update generator run ${id} (${existing.data.run_date}): set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id, ...patch });
      }
      const { data, error } = await updateGeneratorRunLog(
        supabase,
        id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "generator_run_log_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getGeneratorRunLog(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Run log not found" };
      const summary = `DELETE generator run on ${existing.data.run_date} (${existing.data.hours_run} h). This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteGeneratorRunLog(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    case "generator_vendors_create": {
      const parsed = generatorVendorCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const summary = `Add generator vendor "${payload.name}"${payload.phone ? ` (${payload.phone})` : ""}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createGeneratorVendor(
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

    case "generator_vendors_update": {
      const parsed = generatorVendorUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, name_lookup, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      let vendorId = id;
      if (!vendorId && name_lookup) {
        const found = await findGeneratorVendorByName(supabase, name_lookup);
        vendorId = found?.id;
      }
      if (!vendorId) return { error: "Vendor not found" };
      const existing = await getGeneratorVendor(supabase, vendorId);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Vendor not found" };
      const summary = `Update generator vendor "${existing.data.name}": set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id: vendorId, ...patch });
      }
      const { data, error } = await updateGeneratorVendor(
        supabase,
        vendorId,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "generator_vendors_delete": {
      const parsed = generatorVendorDeleteSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      let vendorId = parsed.data.id;
      if (!vendorId && parsed.data.name_lookup) {
        const found = await findGeneratorVendorByName(
          supabase,
          parsed.data.name_lookup,
        );
        vendorId = found?.id;
      }
      if (!vendorId) return { error: "Vendor not found" };
      const existing = await getGeneratorVendor(supabase, vendorId);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Vendor not found" };
      const summary = `DELETE generator vendor "${existing.data.name}"${existing.data.phone ? ` (${existing.data.phone})` : ""}. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id: vendorId });
      }
      const { error } = await deleteGeneratorVendor(supabase, vendorId);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: vendorId };
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

    case "solar_maintenance_create": {
      const parsed = solarMaintenanceCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const plant = resolveSolarPlant(parsed.data.site_id);
      if ("error" in plant) return { error: plant.error };
      const payload = withDefaultNextServiceDue({
        ...parsed.data,
        site_id: plant.id,
        checkup_status: parsed.data.checkup_status ?? "done",
      });
      const summary = `Create solar service for ${plant.label} on ${payload.service_date}${payload.service_type ? ` (${payload.service_type})` : ""}, status ${payload.checkup_status}${payload.next_service_due ? `, next due ${payload.next_service_due}` : " (next due +1 month)"}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createSolarMaintenance(
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

    case "solar_maintenance_update": {
      const parsed = solarMaintenanceUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      if (typeof patch.site_id === "string") {
        const plant = resolveSolarPlant(patch.site_id);
        if ("error" in plant) return { error: plant.error };
        patch.site_id = plant.id;
      }
      const existing = await getSolarMaintenance(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Solar service record not found" };
      const plantLabel = solarSiteDisplayLabel(
        String(patch.site_id ?? existing.data.site_id),
      );
      const summary = `Update solar service ${id} (${plantLabel}, service ${existing.data.service_date}): set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id, ...patch });
      }
      const { data, error } = await updateSolarMaintenance(
        supabase,
        id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "solar_maintenance_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getSolarMaintenance(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Solar service record not found" };
      const plantLabel = solarSiteDisplayLabel(existing.data.site_id);
      const summary = `DELETE solar service for ${plantLabel} on ${existing.data.service_date}${existing.data.service_type ? ` (${existing.data.service_type})` : ""}. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteSolarMaintenance(supabase, id);
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
      const unitPart =
        payload.units_kwh != null ? `, ${payload.units_kwh} units` : "";
      const summary = `Log ${label} payment on ${formatDate(payload.paid_on)}${payload.amount != null ? ` — amount ${payload.amount}` : ""}${unitPart}. Next due ${formatDate(nextDue)}.`;
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

    case "tenants_create": {
      const parsed = tenantCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const {
        attach_agreement,
        agreement_attachment_index,
        ...payload
      } = parsed.data;
      const fileBits = [
        attach_agreement ? "save attached agreement file" : null,
        payload.contract_end_date
          ? `agreement ${formatDate(payload.contract_start_date)} to ${formatDate(payload.contract_end_date)}`
          : null,
      ].filter(Boolean);
      const summary = `Create tenant "${payload.tenant_name}"${payload.gross_rent != null ? ` with gross rent ${payload.gross_rent}` : ""}${fileBits.length ? ` — ${fileBits.join("; ")}` : ""}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(
          name,
          summary,
          injectTenantChatFiles(
            {
              ...payload,
              attach_agreement,
              agreement_attachment_index,
            },
            input,
            ctx,
          ),
        );
      }
      const { data, error, outcome } = await createTenant(
        supabase,
        withUpdatedBy({ ...payload }, user),
      );
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Tenant create failed");
      const agreementFile = asChatFile(input._agreement_file);
      if (agreementFile) {
        const uploaded = await setTenantAgreementFile(
          supabase,
          user,
          data.id,
          agreementFile,
        );
        if (uploaded.error) throw new Error(uploaded.error.message);
      }
      const refreshed = await getTenant(supabase, data.id);
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: refreshed.data ?? data,
      };
    }

    case "tenants_update": {
      const parsed = tenantUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const {
        id,
        tenant_name_lookup,
        attach_agreement,
        clear_agreement_file,
        agreement_attachment_index,
        ...fields
      } = parsed.data;
      const patch = omitTenantFileFlags(
        stripUndefined(fields as Record<string, unknown>),
      );
      const fileOps =
        attach_agreement === true || clear_agreement_file === true;
      if (Object.keys(patch).length === 0 && !fileOps) {
        return { error: "Provide at least one field to update" };
      }
      let tenantId = id;
      if (!tenantId && tenant_name_lookup) {
        const found = await findTenantByName(supabase, tenant_name_lookup);
        tenantId = found?.id;
      }
      if (!tenantId) return { error: "Tenant not found" };
      const existing = await getTenant(supabase, tenantId);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Tenant not found" };
      const row = existing.data as Tenant;
      const fileBits = [
        attach_agreement ? "save attached agreement file" : null,
        clear_agreement_file ? "remove agreement file" : null,
      ].filter(Boolean);
      const summary = `Update tenant "${row.tenant_name}"${Object.keys(patch).length ? `: set ${summarizeFields(patch)}` : ""}${fileBits.length ? ` — ${fileBits.join("; ")}` : ""}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(
          name,
          summary,
          injectTenantChatFiles(
            {
              id: tenantId,
              ...patch,
              attach_agreement,
              clear_agreement_file,
              agreement_attachment_index,
            },
            input,
            ctx,
          ),
        );
      }
      if (Object.keys(patch).length > 0) {
        const { error } = await updateTenant(
          supabase,
          tenantId,
          withUpdatedBy(patch, user),
        );
        if (error) throw new Error(error.message);
      }
      if (clear_agreement_file) {
        const cleared = await clearTenantAgreementFile(supabase, user, tenantId);
        if (cleared.error) throw new Error(cleared.error.message);
      }
      const agreementFile = asChatFile(input._agreement_file);
      if (agreementFile) {
        const uploaded = await setTenantAgreementFile(
          supabase,
          user,
          tenantId,
          agreementFile,
        );
        if (uploaded.error) throw new Error(uploaded.error.message);
      }
      const refreshed = await getTenant(supabase, tenantId);
      return { status: "ok", summary, item: refreshed.data };
    }

    case "tenants_delete": {
      const parsed = tenantDeleteSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      let tenantId = parsed.data.id;
      if (!tenantId && parsed.data.tenant_name_lookup) {
        const found = await findTenantByName(
          supabase,
          parsed.data.tenant_name_lookup,
        );
        tenantId = found?.id;
      }
      if (!tenantId) return { error: "Tenant not found" };
      const existing = await getTenant(supabase, tenantId);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Tenant not found" };
      const summary = `DELETE tenant "${existing.data.tenant_name}" and all rent records and electricity bills. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id: tenantId });
      }
      const { error } = await deleteTenant(supabase, tenantId);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: tenantId };
    }

    case "tenant_rent_payment_create": {
      const parsed = tenantRentPaymentCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const {
        schedule_id,
        tenant_id,
        tenant_name,
        month_date,
        attach_payment,
        payment_attachment_index,
        ...rest
      } = parsed.data;
      let scheduleId = schedule_id;
      if (!scheduleId) {
        let tenantId = tenant_id;
        if (!tenantId && tenant_name) {
          const found = await findTenantByName(supabase, tenant_name);
          tenantId = found?.id;
        }
        if (!tenantId) {
          return { error: "Tenant not found — call tenants_list first." };
        }
        if (!month_date) {
          return { error: "Provide schedule_id or month_date for the ledger month" };
        }
        const [year, month] = month_date.split("-").map(Number);
        const row = await findScheduleByPeriod(supabase, tenantId, year, month);
        if (row.error) throw new Error(row.error.message);
        scheduleId = row.data?.id;
      }
      if (!scheduleId) return { error: "Schedule month not found" };
      const schedule = await getTenantScheduleRow(supabase, scheduleId);
      if (schedule.error) throw new Error(schedule.error.message);
      if (!schedule.data) return { error: "Schedule month not found" };
      const tenant = await getTenant(supabase, schedule.data.tenant_id);
      const label = tenant.data?.tenant_name ?? "tenant";
      const summary = `Record payment of ${rest.amount_received} for ${label} (${schedule.data.period_year}-${String(schedule.data.period_month).padStart(2, "0")})${attach_payment ? " — save attached receipt" : ""}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(
          name,
          summary,
          injectTenantChatFiles(
            {
              schedule_id: scheduleId,
              ...rest,
              attach_payment,
              payment_attachment_index,
            },
            input,
            ctx,
          ),
        );
      }
      const { data, error, outcome } = await createTenantRentPayment(
        supabase,
        withUpdatedBy({ schedule_id: scheduleId, ...rest }, user),
      );
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Payment create failed");
      const paymentFile = asChatFile(input._payment_file);
      if (paymentFile) {
        const uploaded = await setRentPaymentFile(
          supabase,
          user,
          data.id,
          paymentFile,
        );
        if (uploaded.error) throw new Error(uploaded.error.message);
      }
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: data,
      };
    }

    case "tenant_electric_bill_create": {
      const parsed = tenantElectricBillCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const {
        tenant_id,
        tenant_name,
        attach_bill,
        bill_attachment_index,
        ...rest
      } = parsed.data;
      let tenantId = tenant_id;
      if (!tenantId && tenant_name) {
        const found = await findTenantByName(supabase, tenant_name);
        tenantId = found?.id;
      }
      if (!tenantId) return { error: "Tenant not found — call tenants_list or create the tenant first." };
      const tenant = await getTenant(supabase, tenantId);
      if (tenant.error) throw new Error(tenant.error.message);
      if (!tenant.data) return { error: "Tenant not found" };
      const label = tenant.data.tenant_name;
      const periodLabel =
        rest.period_from && rest.period_to
          ? ` ${rest.period_from} to ${rest.period_to}`
          : "";
      const summary = `Log electricity bill for ${label}${periodLabel}${attach_bill ? " — save attached bill file" : ""}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(
          name,
          summary,
          injectTenantChatFiles(
            {
              tenant_id: tenantId,
              ...rest,
              attach_bill,
              bill_attachment_index,
            },
            input,
            ctx,
          ),
        );
      }
      const { data, error, outcome } = await createTenantElectricBill(
        supabase,
        withUpdatedBy({ tenant_id: tenantId, ...rest }, user),
      );
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Electricity bill create failed");
      const billFile = asChatFile(input._bill_file);
      if (billFile) {
        const uploaded = await setElectricBillFile(
          supabase,
          user,
          data.id,
          billFile,
        );
        if (uploaded.error) throw new Error(uploaded.error.message);
      }
      const refreshed = await getTenantElectricBill(supabase, data.id);
      return {
        status: "ok",
        outcome,
        summary: finalizeCreateSummary(summary, outcome),
        item: refreshed.data ?? data,
      };
    }

    case "tenant_electric_bill_update": {
      const parsed = tenantElectricBillUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const {
        id,
        attach_bill,
        clear_bill_file,
        bill_attachment_index,
        ...fields
      } = parsed.data;
      const patch = omitTenantFileFlags(
        stripUndefined(fields as Record<string, unknown>),
      );
      const fileOps = attach_bill === true || clear_bill_file === true;
      if (Object.keys(patch).length === 0 && !fileOps) {
        return { error: "Provide at least one field to update" };
      }
      const existing = await getTenantElectricBill(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Electricity bill not found" };
      const fileBits = [
        attach_bill ? "save attached bill file" : null,
        clear_bill_file ? "remove bill file" : null,
      ].filter(Boolean);
      const summary = `Update tenant electricity bill ${id}${Object.keys(patch).length ? `: set ${summarizeFields(patch)}` : ""}${fileBits.length ? ` — ${fileBits.join("; ")}` : ""}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(
          name,
          summary,
          injectTenantChatFiles(
            {
              id,
              ...patch,
              attach_bill,
              clear_bill_file,
              bill_attachment_index,
            },
            input,
            ctx,
          ),
        );
      }
      if (Object.keys(patch).length > 0) {
        const { data, error } = await updateTenantElectricBill(
          supabase,
          id,
          withUpdatedBy(patch, user),
        );
        if (error) throw new Error(error.message);
        if (!data) return { error: "Electricity bill update failed" };
      }
      if (clear_bill_file) {
        const cleared = await clearElectricBillFile(supabase, user, id);
        if (cleared.error) throw new Error(cleared.error.message);
      }
      const billFile = asChatFile(input._bill_file);
      if (billFile) {
        const uploaded = await setElectricBillFile(
          supabase,
          user,
          id,
          billFile,
        );
        if (uploaded.error) throw new Error(uploaded.error.message);
      }
      const refreshed = await getTenantElectricBill(supabase, id);
      return {
        status: "ok",
        summary,
        item: refreshed.data,
      };
    }

    case "tenant_electric_bill_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getTenantElectricBill(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Electricity bill not found" };
      const summary = `DELETE tenant electricity bill ${id}. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteTenantElectricBill(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    case "chart_of_accounts_entry_create": {
      const parsed = chartOfAccountsEntryCreateSchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const payload = parsed.data;
      const label = chartOfAccountsSectionMeta(payload.ledger).label;
      const summary = `Create ${label} ledger entry on ${payload.entry_date}${payload.ref_no ? ` (${payload.ref_no})` : ""}${payload.account_description ? ` — ${payload.account_description}` : ""}${payload.document_no ? `: ${payload.document_no}` : ""}, debit ${payload.debit}, credit ${payload.credit}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { ...payload });
      }
      const { data, error, outcome } = await createChartOfAccountsEntry(
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

    case "chart_of_accounts_entry_update": {
      const parsed = chartOfAccountsEntryUpdateSchemaAgent.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id, ...fields } = parsed.data;
      const patch = stripUndefined(fields as Record<string, unknown>);
      if (Object.keys(patch).length === 0) {
        return { error: "Provide at least one field to update" };
      }
      const existing = await getChartOfAccountsEntry(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Ledger entry not found" };
      const label = chartOfAccountsSectionMeta(existing.data.ledger).label;
      const summary = `Update ${label} entry ${id} (${existing.data.entry_date}): set ${summarizeFields(patch)}.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id, ...patch });
      }
      const { data, error } = await updateChartOfAccountsEntry(
        supabase,
        id,
        withUpdatedBy(patch, user),
      );
      if (error) throw new Error(error.message);
      return { status: "ok", summary, item: data };
    }

    case "chart_of_accounts_entry_delete": {
      const parsed = idOnlySchema.safeParse(input);
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
      const { id } = parsed.data;
      const existing = await getChartOfAccountsEntry(supabase, id);
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return { error: "Ledger entry not found" };
      const label = chartOfAccountsSectionMeta(existing.data.ledger).label;
      const summary = `DELETE ${label} entry on ${existing.data.entry_date}${existing.data.ref_no ? ` (${existing.data.ref_no})` : ""} debit ${existing.data.debit} / credit ${existing.data.credit}. This cannot be undone.`;
      if (!isConfirmed(input)) {
        return needsConfirmation(name, summary, { id });
      }
      const { error } = await deleteChartOfAccountsEntry(supabase, id);
      if (error) throw new Error(error.message);
      return { status: "ok", summary, deleted_id: id };
    }

    default:
      throw new Error(`Unknown write tool: ${name}`);
  }
}
