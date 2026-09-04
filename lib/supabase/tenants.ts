import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Tenant,
  TenantElectricBill,
  TenantElectricBillInsert,
  TenantElectricBillUpdate,
  TenantInsert,
  TenantRentLineItem,
  TenantRentPayment,
  TenantRentPaymentInsert,
  TenantRentPaymentUpdate,
  TenantRentSchedule,
  TenantUpdate,
} from "@/lib/types/database";
import { removeTenantDocument } from "@/lib/supabase/tenant-storage";
import { incomingShouldOverwrite, normalizeKeyPart } from "@/lib/dashboard/dedupe";
import {
  writeErr,
  writeOk,
  type DomainWriteResult,
} from "@/lib/supabase/write-result";
import { calendarMonthsOverlapping } from "@/lib/tenants/schedule";
import {
  computeGrossRent,
  monthlyTotal,
  tenantOutstanding,
  toLedgerRows,
  type LedgerRow,
} from "@/lib/tenants/ledger";
import { deriveElectricBillFields } from "@/lib/tenants/electricity";

const TENANTS = "tenants" as const;
const LINE_ITEMS = "tenant_rent_line_items" as const;
const SCHEDULE = "tenant_rent_schedule" as const;
const PAYMENTS = "tenant_rent_payments" as const;
const ELECTRIC = "tenant_electric_bills" as const;

export type TenantLineItemInput = { label: string; amount: number };

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

export async function listTenantLineItems(
  supabase: SupabaseClient,
  tenantId: string,
) {
  return supabase
    .from(LINE_ITEMS)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .returns<TenantRentLineItem[]>();
}

export async function listTenantSchedule(
  supabase: SupabaseClient,
  tenantId?: string,
) {
  let q = supabase
    .from(SCHEDULE)
    .select("*")
    .order("period_year", { ascending: true })
    .order("period_month", { ascending: true });
  if (tenantId) q = q.eq("tenant_id", tenantId);
  return q.returns<TenantRentSchedule[]>();
}

export async function getTenantScheduleRow(
  supabase: SupabaseClient,
  id: string,
) {
  const { data, error } = await supabase
    .from(SCHEDULE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: (data as TenantRentSchedule | null) ?? null, error };
}

export async function findScheduleByPeriod(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number,
) {
  const { data, error } = await supabase
    .from(SCHEDULE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();
  return { data: (data as TenantRentSchedule | null) ?? null, error };
}

export async function listTenantRentPayments(
  supabase: SupabaseClient,
  scheduleIds?: string[],
) {
  let q = supabase.from(PAYMENTS).select("*").order("created_at", {
    ascending: true,
  });
  if (scheduleIds) {
    if (scheduleIds.length === 0) {
      return { data: [] as TenantRentPayment[], error: null };
    }
    q = q.in("schedule_id", scheduleIds);
  }
  return q.returns<TenantRentPayment[]>();
}

export async function getTenantRentPayment(
  supabase: SupabaseClient,
  id: string,
) {
  const { data, error } = await supabase
    .from(PAYMENTS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: (data as TenantRentPayment | null) ?? null, error };
}

export async function listTenantElectricBills(
  supabase: SupabaseClient,
  tenantId?: string,
) {
  let q = supabase
    .from(ELECTRIC)
    .select("*")
    .order("period_to", { ascending: false, nullsFirst: false })
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

export async function getTenantLedger(supabase: SupabaseClient, tenantId: string) {
  const [tenant, lineItems, schedule] = await Promise.all([
    getTenant(supabase, tenantId),
    listTenantLineItems(supabase, tenantId),
    listTenantSchedule(supabase, tenantId),
  ]);
  if (tenant.error) return { error: tenant.error, data: null };
  if (lineItems.error) return { error: lineItems.error, data: null };
  if (schedule.error) return { error: schedule.error, data: null };
  const payments = await listTenantRentPayments(
    supabase,
    (schedule.data ?? []).map((row) => row.id),
  );
  if (payments.error) return { error: payments.error, data: null };
  const rows = toLedgerRows(schedule.data ?? [], payments.data ?? []);
  return {
    error: null,
    data: {
      tenant: tenant.data,
      line_items: lineItems.data ?? [],
      schedule: rows,
      outstanding: tenantOutstanding(rows),
    },
  };
}

export type TenantListSummary = Tenant & {
  monthly_total: number;
  outstanding: number;
  month_count: number;
};

export async function listTenantSummaries(supabase: SupabaseClient) {
  const tenants = await listTenants(supabase);
  if (tenants.error) return { data: null as TenantListSummary[] | null, error: tenants.error };
  const schedule = await listTenantSchedule(supabase);
  if (schedule.error) return { data: null, error: schedule.error };
  const payments = await listTenantRentPayments(
    supabase,
    (schedule.data ?? []).map((row) => row.id),
  );
  if (payments.error) return { data: null, error: payments.error };
  const lineItemsByTenant = new Map<string, { amount: number }[]>();
  const { data: allItems, error: itemsError } = await supabase
    .from(LINE_ITEMS)
    .select("*")
    .order("sort_order", { ascending: true })
    .returns<TenantRentLineItem[]>();
  if (itemsError) return { data: null, error: itemsError };
  for (const item of allItems ?? []) {
    const list = lineItemsByTenant.get(item.tenant_id) ?? [];
    list.push({ amount: Number(item.amount ?? 0) });
    lineItemsByTenant.set(item.tenant_id, list);
  }
  const rowsByTenant = new Map<string, LedgerRow[]>();
  const allRows = toLedgerRows(schedule.data ?? [], payments.data ?? []);
  for (const row of allRows) {
    const list = rowsByTenant.get(row.tenant_id) ?? [];
    list.push(row);
    rowsByTenant.set(row.tenant_id, list);
  }
  const data: TenantListSummary[] = (tenants.data ?? []).map((tenant) => {
    const rows = rowsByTenant.get(tenant.id) ?? [];
    return {
      ...tenant,
      monthly_total: monthlyTotal(
        tenant.gross_rent,
        lineItemsByTenant.get(tenant.id) ?? [],
      ),
      outstanding: tenantOutstanding(rows),
      month_count: rows.length,
    };
  });
  return { data, error: null };
}

function tenantPayload(
  input: TenantInsert | TenantUpdate,
): TenantInsert | TenantUpdate {
  const next: TenantInsert | TenantUpdate = { ...input };
  const rentTouched =
    input.rate_type !== undefined ||
    input.sqft !== undefined ||
    input.rate !== undefined ||
    input.gross_rent !== undefined;
  if (rentTouched) {
    const rateType = input.rate_type === "lum_sum" ? "lum_sum" : "per_sqft";
    next.rate_type = input.rate_type ?? rateType;
    next.gross_rent = computeGrossRent({
      rate_type: rateType,
      sqft: input.sqft,
      rate: input.rate,
      gross_rent: input.gross_rent,
    });
  }
  if (input.contract_end_date !== undefined) {
    next.agreement_expiry = input.contract_end_date;
  }
  return next;
}

async function replaceLineItems(
  supabase: SupabaseClient,
  tenantId: string,
  items: TenantLineItemInput[] | undefined,
  updatedBy?: string | null,
) {
  if (!items) return { error: null };
  const del = await supabase.from(LINE_ITEMS).delete().eq("tenant_id", tenantId);
  if (del.error) return { error: del.error };
  if (items.length === 0) return { error: null };
  const rows = items.map((item, index) => ({
    tenant_id: tenantId,
    label: item.label.trim(),
    amount: Number(item.amount ?? 0),
    sort_order: index,
    updated_by: updatedBy ?? null,
  }));
  const { error } = await supabase.from(LINE_ITEMS).insert(rows);
  return { error };
}

export async function countSchedulePayments(
  supabase: SupabaseClient,
  tenantId: string,
) {
  const schedule = await listTenantSchedule(supabase, tenantId);
  if (schedule.error) return { count: 0, error: schedule.error };
  const ids = (schedule.data ?? []).map((row) => row.id);
  if (ids.length === 0) return { count: 0, error: null };
  const payments = await listTenantRentPayments(supabase, ids);
  if (payments.error) return { count: 0, error: payments.error };
  return { count: payments.data?.length ?? 0, error: null };
}

export async function regenerateTenantSchedule(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { force?: boolean; updatedBy?: string | null },
): Promise<{ error: { message: string } | null; paymentCount?: number }> {
  const tenant = await getTenant(supabase, tenantId);
  if (tenant.error) return { error: { message: tenant.error.message } };
  if (!tenant.data) return { error: { message: "Tenant not found" } };
  const start = tenant.data.contract_start_date;
  const end = tenant.data.contract_end_date;
  if (!start || !end) {
    return { error: { message: "Contract start and end dates are required" } };
  }

  const existing = await listTenantSchedule(supabase, tenantId);
  if (existing.error) return { error: { message: existing.error.message } };
  const existingRows = existing.data ?? [];
  const existingIds = existingRows.map((row) => row.id);
  const payments = await listTenantRentPayments(supabase, existingIds);
  if (payments.error) return { error: { message: payments.error.message } };
  const paymentCount = payments.data?.length ?? 0;
  if (paymentCount > 0 && !options?.force) {
    return {
      error: {
        message:
          "This tenant already has recorded payments. Confirm regenerate_schedule to rebuild the monthly ledger (payments on removed months will be deleted).",
      },
      paymentCount,
    };
  }

  const lineItems = await listTenantLineItems(supabase, tenantId);
  if (lineItems.error) return { error: { message: lineItems.error.message } };
  const snapshot = (lineItems.data ?? []).map((item) => ({
    label: item.label,
    amount: Number(item.amount ?? 0),
  }));
  const totalDue = monthlyTotal(tenant.data.gross_rent, snapshot);
  const periods = calendarMonthsOverlapping(start, end);
  const keepKeys = new Set(
    periods.map((p) => `${p.period_year}-${p.period_month}`),
  );
  const byKey = new Map(
    existingRows.map((row) => [`${row.period_year}-${row.period_month}`, row]),
  );

  for (const period of periods) {
    const key = `${period.period_year}-${period.period_month}`;
    const payload = {
      tenant_id: tenantId,
      serial_no: period.serial_no,
      period_year: period.period_year,
      period_month: period.period_month,
      period_start: period.period_start,
      period_end: period.period_end,
      survey_no: tenant.data.survey_no,
      sqft: tenant.data.sqft,
      rate: tenant.data.rate,
      rate_type: tenant.data.rate_type,
      gross_rent: tenant.data.gross_rent,
      line_items: snapshot,
      total_due: totalDue,
      updated_by: options?.updatedBy ?? null,
    };
    const found = byKey.get(key);
    if (found) {
      const { error } = await supabase
        .from(SCHEDULE)
        .update(payload)
        .eq("id", found.id);
      if (error) return { error: { message: error.message } };
    } else {
      const { error } = await supabase.from(SCHEDULE).insert(payload);
      if (error) return { error: { message: error.message } };
    }
  }

  const stale = existingRows.filter(
    (row) => !keepKeys.has(`${row.period_year}-${row.period_month}`),
  );
  for (const row of stale) {
    const rowPayments = (payments.data ?? []).filter(
      (p) => p.schedule_id === row.id,
    );
    for (const payment of rowPayments) {
      if (payment.payment_file_url) {
        await removeTenantDocument(supabase, payment.payment_file_url);
      }
    }
    const { error } = await supabase.from(SCHEDULE).delete().eq("id", row.id);
    if (error) return { error: { message: error.message } };
  }

  return { error: null, paymentCount };
}

export async function createTenant(
  supabase: SupabaseClient,
  input: TenantInsert & { line_items?: TenantLineItemInput[] },
): Promise<DomainWriteResult<Tenant>> {
  const existing = await findTenantByName(supabase, input.tenant_name);
  const { line_items, ...rest } = input;
  const payload = tenantPayload(rest) as TenantInsert;

  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: payload.contract_start_date ?? null,
      existingDate: existing.contract_start_date ?? existing.updated_at,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) return writeOk(existing, "skipped");
    const { data, error } = await supabase
      .from(TENANTS)
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single<Tenant>();
    if (error) return writeErr(error.message);
    const items = await replaceLineItems(
      supabase,
      existing.id,
      line_items,
      payload.updated_by,
    );
    if (items.error) return writeErr(items.error.message);
    const regen = await regenerateTenantSchedule(supabase, existing.id, {
      force: true,
      updatedBy: payload.updated_by,
    });
    if (regen.error) return writeErr(regen.error.message);
    const refreshed = await getTenant(supabase, existing.id);
    return writeOk(refreshed.data ?? data, "updated");
  }

  const { data, error } = await supabase
    .from(TENANTS)
    .insert(payload)
    .select("*")
    .single<Tenant>();
  if (error) return writeErr(error.message);
  const items = await replaceLineItems(
    supabase,
    data.id,
    line_items ?? [],
    payload.updated_by,
  );
  if (items.error) return writeErr(items.error.message);
  const regen = await regenerateTenantSchedule(supabase, data.id, {
    force: true,
    updatedBy: payload.updated_by,
  });
  if (regen.error) return writeErr(regen.error.message);
  const refreshed = await getTenant(supabase, data.id);
  return writeOk(refreshed.data ?? data, "created");
}

function contractTermsChanged(input: TenantUpdate) {
  return (
    input.contract_start_date !== undefined ||
    input.contract_end_date !== undefined ||
    input.sqft !== undefined ||
    input.rate !== undefined ||
    input.rate_type !== undefined ||
    input.gross_rent !== undefined ||
    input.survey_no !== undefined
  );
}

export async function updateTenant(
  supabase: SupabaseClient,
  id: string,
  input: TenantUpdate & {
    line_items?: TenantLineItemInput[];
    regenerate_schedule?: boolean;
  },
) {
  const { line_items, regenerate_schedule, ...rest } = input;
  const payload = tenantPayload(rest);
  const result = await supabase
    .from(TENANTS)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single<Tenant>();
  if (result.error) return result;

  if (line_items) {
    const items = await replaceLineItems(
      supabase,
      id,
      line_items,
      payload.updated_by,
    );
    if (items.error) {
      return { data: null, error: items.error };
    }
  }

  const shouldRegen =
    Boolean(line_items) ||
    contractTermsChanged(rest) ||
    regenerate_schedule === true;
  if (shouldRegen) {
    const regen = await regenerateTenantSchedule(supabase, id, {
      force: regenerate_schedule === true,
      updatedBy: payload.updated_by,
    });
    if (regen.error) return { data: null, error: regen.error };
  }

  return getTenant(supabase, id);
}

export async function deleteTenant(supabase: SupabaseClient, id: string) {
  const existing = await getTenant(supabase, id);
  const schedule = await listTenantSchedule(supabase, id);
  const payments = await listTenantRentPayments(
    supabase,
    (schedule.data ?? []).map((row) => row.id),
  );
  const bills = await listTenantElectricBills(supabase, id);
  const paths = [
    existing.data?.agreement_file_url,
    existing.data?.payment_file_url,
    ...(payments.data ?? []).map((row) => row.payment_file_url),
    ...(bills.data ?? []).map((row) => row.bill_file_url),
  ].filter((p): p is string => Boolean(p));
  for (const path of [...new Set(paths)]) {
    await removeTenantDocument(supabase, path);
  }
  return supabase.from(TENANTS).delete().eq("id", id);
}

export async function createTenantRentPayment(
  supabase: SupabaseClient,
  input: TenantRentPaymentInsert,
): Promise<DomainWriteResult<TenantRentPayment>> {
  const { data, error } = await supabase
    .from(PAYMENTS)
    .insert(input)
    .select("*")
    .single<TenantRentPayment>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateTenantRentPayment(
  supabase: SupabaseClient,
  id: string,
  input: TenantRentPaymentUpdate,
) {
  return supabase
    .from(PAYMENTS)
    .update(input)
    .eq("id", id)
    .select("*")
    .single<TenantRentPayment>();
}

export async function deleteTenantRentPayment(
  supabase: SupabaseClient,
  id: string,
) {
  const existing = await getTenantRentPayment(supabase, id);
  if (existing.data?.payment_file_url) {
    await removeTenantDocument(supabase, existing.data.payment_file_url);
  }
  return supabase.from(PAYMENTS).delete().eq("id", id);
}

function buildElectricBillRow(
  tenantId: string,
  input: {
    period_from?: string | null;
    period_to?: string | null;
    last_reading?: number | null;
    current_reading?: number | null;
    rate_inclusive_govt?: number | null;
    amount_received?: number | null;
    payment_date?: string | null;
    notes?: string | null;
    updated_by?: string | null;
  },
  existing?: TenantElectricBill | null,
): TenantElectricBillInsert {
  const derived = deriveElectricBillFields({
    period_from: input.period_from ?? existing?.period_from ?? null,
    period_to: input.period_to ?? existing?.period_to ?? null,
    last_reading:
      input.last_reading !== undefined
        ? input.last_reading
        : (existing?.last_reading ?? null),
    current_reading:
      input.current_reading !== undefined
        ? input.current_reading
        : (existing?.current_reading ?? null),
    rate_inclusive_govt:
      input.rate_inclusive_govt !== undefined
        ? input.rate_inclusive_govt
        : (existing?.rate_inclusive_govt ?? null),
    amount_received:
      input.amount_received !== undefined
        ? input.amount_received
        : (existing?.amount_received ?? null),
    payment_date:
      input.payment_date !== undefined
        ? input.payment_date
        : (existing?.payment_date ?? null),
    notes:
      input.notes !== undefined ? input.notes : (existing?.notes ?? null),
  });
  return {
    tenant_id: tenantId,
    ...derived,
    ...(input.updated_by !== undefined
      ? { updated_by: input.updated_by }
      : {}),
  };
}

async function upsertElectricBillForPeriod(
  supabase: SupabaseClient,
  input: TenantElectricBillInsert & {
    period_from?: string | null;
    period_to?: string | null;
    last_reading?: number | null;
    current_reading?: number | null;
    rate_inclusive_govt?: number | null;
    amount_received?: number | null;
  },
): Promise<DomainWriteResult<TenantElectricBill>> {
  const row = buildElectricBillRow(input.tenant_id, input);
  const periodFrom = row.period_from;
  const periodTo = row.period_to;

  if (periodFrom && periodTo) {
    const { data: existingRows } = await supabase
      .from(ELECTRIC)
      .select("*")
      .eq("tenant_id", input.tenant_id)
      .eq("period_from", periodFrom)
      .eq("period_to", periodTo)
      .returns<TenantElectricBill[]>();
    const existing = existingRows?.[0] ?? null;
    if (existing) {
      const overwrite = incomingShouldOverwrite({
        incomingDate: row.payment_date ?? periodTo,
        existingDate:
          existing.payment_date ?? existing.period_to ?? existing.due_date,
        existingUpdatedAt: existing.updated_at,
      });
      if (!overwrite) return writeOk(existing, "skipped");
      const { data, error } = await supabase
        .from(ELECTRIC)
        .update({
          ...row,
          bill_file_url: existing.bill_file_url,
        })
        .eq("id", existing.id)
        .select("*")
        .single<TenantElectricBill>();
      if (error) return writeErr(error.message);
      return writeOk(data, "updated");
    }
  }

  const { data, error } = await supabase
    .from(ELECTRIC)
    .insert(row)
    .select("*")
    .single<TenantElectricBill>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function createTenantElectricBill(
  supabase: SupabaseClient,
  input: TenantElectricBillInsert & {
    period_from?: string | null;
    period_to?: string | null;
    last_reading?: number | null;
    current_reading?: number | null;
    rate_inclusive_govt?: number | null;
    amount_received?: number | null;
  },
): Promise<DomainWriteResult<TenantElectricBill>> {
  return upsertElectricBillForPeriod(supabase, input);
}

export async function updateTenantElectricBill(
  supabase: SupabaseClient,
  id: string,
  input: TenantElectricBillUpdate & {
    period_from?: string | null;
    period_to?: string | null;
    last_reading?: number | null;
    current_reading?: number | null;
    rate_inclusive_govt?: number | null;
    amount_received?: number | null;
  },
) {
  const existing = await getTenantElectricBill(supabase, id);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return { data: null, error: { message: "Electricity bill not found" } };
  }
  const row = buildElectricBillRow(
    existing.data.tenant_id,
    {
      ...input,
      period_from:
        input.period_from !== undefined
          ? input.period_from
          : existing.data.period_from,
      period_to:
        input.period_to !== undefined
          ? input.period_to
          : existing.data.period_to,
    },
    existing.data,
  );
  const { tenant_id: _tid, ...patch } = row;
  return supabase
    .from(ELECTRIC)
    .update({
      ...patch,
      bill_file_url: existing.data.bill_file_url,
    })
    .eq("id", id)
    .select("*")
    .single<TenantElectricBill>();
}

export async function deleteTenantElectricBill(
  supabase: SupabaseClient,
  id: string,
) {
  const existing = await getTenantElectricBill(supabase, id);
  if (existing.error) return { error: existing.error };
  if (existing.data?.bill_file_url) {
    await removeTenantDocument(supabase, existing.data.bill_file_url);
  }
  return supabase.from(ELECTRIC).delete().eq("id", id);
}
