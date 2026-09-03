import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Tenant,
  TenantElectricBill,
  TenantElectricBillInsert,
  TenantElectricBillUpdate,
  TenantInsert,
  TenantRentLog,
  TenantRentLogInsert,
  TenantRentLogUpdate,
  TenantUpdate,
} from "@/lib/types/database";
import { removeTenantDocument } from "@/lib/supabase/tenant-storage";
import {
  incomingShouldOverwrite,
  normalizeKeyPart,
} from "@/lib/dashboard/dedupe";
import {
  writeErr,
  writeOk,
  type DomainWriteResult,
} from "@/lib/supabase/write-result";

const TENANTS = "tenants" as const;
const RENT_LOGS = "tenant_rent_logs" as const;
const ELECTRIC = "tenant_electric_bills" as const;

function hasRentSnapshot(input: {
  rent_amount?: number | null;
  rent_due_date?: string | null;
  payment_date?: string | null;
  outstanding_amount?: number | null;
  payment_status?: string | null;
}) {
  return (
    input.rent_amount != null ||
    Boolean(input.rent_due_date) ||
    Boolean(input.payment_date) ||
    input.outstanding_amount != null ||
    (input.payment_status != null && input.payment_status !== "unpaid")
  );
}

export async function listTenants(supabase: SupabaseClient) {
  return supabase
    .from(TENANTS)
    .select("*")
    .order("tenant_name", { ascending: true })
    .returns<Tenant[]>();
}

export async function getTenant(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from(TENANTS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: (data as Tenant | null) ?? null, error };
}

export async function findTenantByName(
  supabase: SupabaseClient,
  name: string,
): Promise<Tenant | null> {
  const key = normalizeKeyPart(name);
  if (!key) return null;
  const { data, error } = await supabase
    .from(TENANTS)
    .select("*")
    .ilike("tenant_name", name.trim())
    .returns<Tenant[]>();
  if (error || !data?.length) {
    // Fallback: scan all names for a normalized match (spaces / case)
    const all = await listTenants(supabase);
    if (all.error || !all.data?.length) return null;
    return (
      all.data.find((r) => normalizeKeyPart(r.tenant_name) === key) ?? null
    );
  }
  return (
    data.find((r) => normalizeKeyPart(r.tenant_name) === key) ?? data[0] ?? null
  );
}

export async function listTenantRentLogs(
  supabase: SupabaseClient,
  tenantId?: string,
) {
  let q = supabase
    .from(RENT_LOGS)
    .select("*")
    .order("rent_due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (tenantId) q = q.eq("tenant_id", tenantId);
  return q.returns<TenantRentLog[]>();
}

export async function getTenantRentLog(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from(RENT_LOGS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: (data as TenantRentLog | null) ?? null, error };
}

export async function listTenantElectricBills(
  supabase: SupabaseClient,
  tenantId?: string,
) {
  let q = supabase
    .from(ELECTRIC)
    .select("*")
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (tenantId) q = q.eq("tenant_id", tenantId);
  return q.returns<TenantElectricBill[]>();
}

export async function getTenantElectricBill(
  supabase: SupabaseClient,
  id: string,
) {
  const { data, error } = await supabase
    .from(ELECTRIC)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: (data as TenantElectricBill | null) ?? null, error };
}

async function applyLatestRentSnapshot(
  supabase: SupabaseClient,
  tenantId: string,
  updatedBy?: string | null,
) {
  const { data: logs, error } = await listTenantRentLogs(supabase, tenantId);
  if (error) return { error };
  const latest = logs?.[0] ?? null;
  const patch: TenantUpdate = latest
    ? {
        rent_amount: latest.rent_amount,
        rent_due_date: latest.rent_due_date,
        payment_status: latest.payment_status,
        payment_date: latest.payment_date,
        outstanding_amount: latest.outstanding_amount,
        payment_file_url: latest.payment_file_url,
      }
    : {
        rent_amount: null,
        rent_due_date: null,
        payment_status: "unpaid",
        payment_date: null,
        outstanding_amount: null,
        payment_file_url: null,
      };
  if (updatedBy) patch.updated_by = updatedBy;
  return supabase.from(TENANTS).update(patch).eq("id", tenantId);
}

function rentSnapshotFromTenant(
  input: TenantInsert | TenantUpdate,
  tenantId: string,
): TenantRentLogInsert | null {
  if (!hasRentSnapshot(input)) return null;
  return {
    tenant_id: tenantId,
    rent_amount: input.rent_amount ?? null,
    rent_due_date: input.rent_due_date ?? null,
    payment_status: input.payment_status ?? "unpaid",
    payment_date: input.payment_date ?? null,
    outstanding_amount: input.outstanding_amount ?? null,
    notes: input.notes ?? null,
    updated_by: input.updated_by ?? null,
  };
}

async function upsertRentLogForDueDate(
  supabase: SupabaseClient,
  input: TenantRentLogInsert,
): Promise<DomainWriteResult<TenantRentLog>> {
  const due = input.rent_due_date?.trim() || null;
  if (due) {
    const { data: existingRows } = await supabase
      .from(RENT_LOGS)
      .select("*")
      .eq("tenant_id", input.tenant_id)
      .eq("rent_due_date", due)
      .returns<TenantRentLog[]>();
    const existing = existingRows?.[0] ?? null;
    if (existing) {
      const overwrite = incomingShouldOverwrite({
        incomingDate: input.payment_date ?? due,
        existingDate: existing.payment_date ?? existing.rent_due_date,
        existingUpdatedAt: existing.updated_at,
      });
      if (!overwrite) {
        await applyLatestRentSnapshot(
          supabase,
          input.tenant_id,
          input.updated_by,
        );
        return writeOk(existing, "skipped");
      }
      const { data, error } = await supabase
        .from(RENT_LOGS)
        .update(input)
        .eq("id", existing.id)
        .select("*")
        .single<TenantRentLog>();
      if (error) return writeErr(error.message);
      await applyLatestRentSnapshot(supabase, input.tenant_id, input.updated_by);
      return writeOk(data, "updated");
    }
  }

  const { data, error } = await supabase
    .from(RENT_LOGS)
    .insert(input)
    .select("*")
    .single<TenantRentLog>();
  if (error) return writeErr(error.message);
  await applyLatestRentSnapshot(supabase, input.tenant_id, input.updated_by);
  return writeOk(data, "created");
}

export async function createTenant(
  supabase: SupabaseClient,
  input: TenantInsert,
): Promise<DomainWriteResult<Tenant>> {
  const existing = await findTenantByName(supabase, input.tenant_name);
  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: input.rent_due_date ?? input.payment_date ?? null,
      existingDate: existing.rent_due_date ?? existing.payment_date,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) return writeOk(existing, "skipped");
    const { data, error } = await supabase
      .from(TENANTS)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<Tenant>();
    if (error) return writeErr(error.message);
    const log = rentSnapshotFromTenant(input, existing.id);
    if (log) await upsertRentLogForDueDate(supabase, log);
    const refreshed = await getTenant(supabase, existing.id);
    return writeOk(refreshed.data ?? data, "updated");
  }

  const { data, error } = await supabase
    .from(TENANTS)
    .insert(input)
    .select("*")
    .single<Tenant>();
  if (error) return writeErr(error.message);
  const log = rentSnapshotFromTenant(input, data.id);
  if (log) await upsertRentLogForDueDate(supabase, log);
  const refreshed = await getTenant(supabase, data.id);
  return writeOk(refreshed.data ?? data, "created");
}

export async function updateTenant(
  supabase: SupabaseClient,
  id: string,
  input: TenantUpdate,
) {
  const result = await supabase
    .from(TENANTS)
    .update(input)
    .eq("id", id)
    .select("*")
    .single<Tenant>();
  if (!result.error && hasRentSnapshot(input)) {
    const log = rentSnapshotFromTenant(input, id);
    if (log) await upsertRentLogForDueDate(supabase, log);
    return getTenant(supabase, id);
  }
  return result;
}

export async function deleteTenant(supabase: SupabaseClient, id: string) {
  const existing = await getTenant(supabase, id);
  const logs = await listTenantRentLogs(supabase, id);
  const paths = [
    existing.data?.agreement_file_url,
    existing.data?.payment_file_url,
    ...(logs.data ?? []).map((row) => row.payment_file_url),
  ].filter((p): p is string => Boolean(p));
  const unique = [...new Set(paths)];
  for (const path of unique) {
    await removeTenantDocument(supabase, path);
  }
  return supabase.from(TENANTS).delete().eq("id", id);
}

export async function createTenantRentLog(
  supabase: SupabaseClient,
  input: TenantRentLogInsert,
): Promise<DomainWriteResult<TenantRentLog>> {
  return upsertRentLogForDueDate(supabase, input);
}

export async function updateTenantRentLog(
  supabase: SupabaseClient,
  id: string,
  input: TenantRentLogUpdate,
) {
  const existing = await getTenantRentLog(supabase, id);
  if (existing.error) return existing;
  if (!existing.data) {
    return { data: null, error: { message: "Rent log not found" } };
  }
  const result = await supabase
    .from(RENT_LOGS)
    .update(input)
    .eq("id", id)
    .select("*")
    .single<TenantRentLog>();
  if (!result.error) {
    await applyLatestRentSnapshot(
      supabase,
      existing.data.tenant_id,
      input.updated_by,
    );
  }
  return result;
}

export async function deleteTenantRentLog(
  supabase: SupabaseClient,
  id: string,
) {
  const existing = await getTenantRentLog(supabase, id);
  if (existing.data?.payment_file_url) {
    const tenant = await getTenant(supabase, existing.data.tenant_id);
    const shared =
      tenant.data?.payment_file_url === existing.data.payment_file_url;
    if (!shared) {
      await removeTenantDocument(supabase, existing.data.payment_file_url);
    }
  }
  const result = await supabase.from(RENT_LOGS).delete().eq("id", id);
  if (!result.error && existing.data) {
    await applyLatestRentSnapshot(supabase, existing.data.tenant_id);
  }
  return result;
}

async function upsertElectricBillForDueDate(
  supabase: SupabaseClient,
  input: TenantElectricBillInsert,
): Promise<DomainWriteResult<TenantElectricBill>> {
  const due = input.due_date?.trim() || null;
  if (due) {
    const { data: existingRows } = await supabase
      .from(ELECTRIC)
      .select("*")
      .eq("tenant_id", input.tenant_id)
      .eq("due_date", due)
      .returns<TenantElectricBill[]>();
    const existing = existingRows?.[0] ?? null;
    if (existing) {
      const overwrite = incomingShouldOverwrite({
        incomingDate: input.payment_date ?? due,
        existingDate: existing.payment_date ?? existing.due_date,
        existingUpdatedAt: existing.updated_at,
      });
      if (!overwrite) return writeOk(existing, "skipped");
      const { data, error } = await supabase
        .from(ELECTRIC)
        .update(input)
        .eq("id", existing.id)
        .select("*")
        .single<TenantElectricBill>();
      if (error) return writeErr(error.message);
      return writeOk(data, "updated");
    }
  }

  const { data, error } = await supabase
    .from(ELECTRIC)
    .insert(input)
    .select("*")
    .single<TenantElectricBill>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function createTenantElectricBill(
  supabase: SupabaseClient,
  input: TenantElectricBillInsert,
): Promise<DomainWriteResult<TenantElectricBill>> {
  return upsertElectricBillForDueDate(supabase, input);
}

export async function updateTenantElectricBill(
  supabase: SupabaseClient,
  id: string,
  input: TenantElectricBillUpdate,
) {
  return supabase
    .from(ELECTRIC)
    .update(input)
    .eq("id", id)
    .select("*")
    .single<TenantElectricBill>();
}

export async function deleteTenantElectricBill(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(ELECTRIC).delete().eq("id", id);
}
