import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Tenant,
  TenantBroker,
  TenantBrokerInsert,
  TenantBrokerUpdate,
} from "@/lib/types/database";
import {
  writeErr,
  writeOk,
  type DomainWriteResult,
} from "@/lib/supabase/write-result";
import { getTenant } from "@/lib/supabase/tenants";
import {
  computeBrokerCommission,
  monthlyRentForBroker,
} from "@/lib/tenants/broker-commission";

const TABLE = "tenant_brokers" as const;

export type TenantBrokerListRow = TenantBroker & {
  tenant_name: string;
  survey_no: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
};

type TenantJoin = {
  tenant_name: string;
  survey_no: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
};

function flatten(
  row: TenantBroker & { tenants?: TenantJoin | TenantJoin[] | null },
): TenantBrokerListRow {
  const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
  const { tenants: _ignored, ...rest } = row;
  return {
    ...rest,
    tenant_name: tenant?.tenant_name ?? "",
    survey_no: tenant?.survey_no ?? null,
    contract_start_date: tenant?.contract_start_date ?? null,
    contract_end_date: tenant?.contract_end_date ?? null,
  };
}

const LIST_SELECT =
  "*, tenants(tenant_name, survey_no, contract_start_date, contract_end_date)";

export async function listTenantBrokers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(LIST_SELECT)
    .order("broker_name", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { data: null as TenantBrokerListRow[] | null, error };
  return {
    data: ((data ?? []) as Array<TenantBroker & { tenants?: TenantJoin | null }>).map(
      flatten,
    ),
    error: null,
  };
}

export async function getTenantBroker(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(LIST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return { data: null as TenantBrokerListRow | null, error };
  return {
    data: data
      ? flatten(data as TenantBroker & { tenants?: TenantJoin | null })
      : null,
    error: null,
  };
}

async function computedPayload(
  supabase: SupabaseClient,
  input: {
    tenant_id: string;
    broker_name?: string;
    sqft?: number | null;
    rate?: number | null;
    notes?: string | null;
    updated_by?: string | null;
  },
  existing?: TenantBroker | null,
) {
  const tenant = await getTenant(supabase, input.tenant_id);
  if (tenant.error) return { error: { message: tenant.error.message } };
  if (!tenant.data) return { error: { message: "Tenant not found" } };
  const row = tenant.data as Tenant;
  const sqft = input.sqft !== undefined ? input.sqft : existing?.sqft ?? row.sqft;
  const rate = input.rate !== undefined ? input.rate : existing?.rate ?? row.rate;
  const monthly_rent = monthlyRentForBroker({
    sqft,
    rate,
    fallback_gross: row.gross_rent,
  });
  const billed = computeBrokerCommission({
    monthly_rent,
    contract_start_date: row.contract_start_date,
    contract_end_date: row.contract_end_date,
  });
  return {
    error: null,
    tenant: row,
    payload: {
      tenant_id: input.tenant_id,
      broker_name: input.broker_name?.trim() ?? existing?.broker_name ?? "",
      sqft,
      rate,
      monthly_rent: billed.monthly_rent,
      stay_months: billed.full_months,
      stay_days: billed.leftover_days,
      stay_factor: billed.stay_factor,
      commission_amount: billed.commission_amount,
      notes: input.notes !== undefined ? input.notes : existing?.notes ?? null,
      updated_by: input.updated_by ?? null,
    },
  };
}

export async function createTenantBroker(
  supabase: SupabaseClient,
  input: TenantBrokerInsert,
): Promise<DomainWriteResult<TenantBrokerListRow>> {
  if (!input.broker_name?.trim()) return writeErr("Broker name is required");
  if (!input.tenant_id) return writeErr("Select a tenant");
  const computed = await computedPayload(supabase, {
    tenant_id: input.tenant_id,
    broker_name: input.broker_name,
    sqft: input.sqft,
    rate: input.rate,
    notes: input.notes,
    updated_by: input.updated_by,
  });
  if (computed.error) return writeErr(computed.error.message);
  if (!computed.payload) return writeErr("Could not calculate commission");
  const { data, error } = await supabase
    .from(TABLE)
    .insert(computed.payload)
    .select(LIST_SELECT)
    .single();
  if (error) return writeErr(error.message);
  return writeOk(
    flatten(data as TenantBroker & { tenants?: TenantJoin | null }),
    "created",
  );
}

export async function updateTenantBroker(
  supabase: SupabaseClient,
  id: string,
  input: TenantBrokerUpdate,
): Promise<DomainWriteResult<TenantBrokerListRow>> {
  const existing = await getTenantBroker(supabase, id);
  if (existing.error) return writeErr(existing.error.message);
  if (!existing.data) return writeErr("Broker record not found");
  const tenantId = input.tenant_id ?? existing.data.tenant_id;
  const computed = await computedPayload(
    supabase,
    {
      tenant_id: tenantId,
      broker_name: input.broker_name ?? existing.data.broker_name,
      sqft: input.sqft,
      rate: input.rate,
      notes: input.notes,
      updated_by: input.updated_by,
    },
    existing.data,
  );
  if (computed.error) return writeErr(computed.error.message);
  if (!computed.payload) return writeErr("Could not calculate commission");
  const { data, error } = await supabase
    .from(TABLE)
    .update(computed.payload)
    .eq("id", id)
    .select(LIST_SELECT)
    .single();
  if (error) return writeErr(error.message);
  return writeOk(
    flatten(data as TenantBroker & { tenants?: TenantJoin | null }),
    "updated",
  );
}

export async function deleteTenantBroker(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  return { error: error ? { message: error.message } : null };
}
