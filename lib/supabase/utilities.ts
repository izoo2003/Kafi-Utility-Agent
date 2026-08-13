import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  UtilityAccount,
  UtilityAccountInsert,
  UtilityAccountUpdate,
  UtilityPaymentLog,
  UtilityPaymentLogInsert,
} from "@/lib/types/database";
import { normalizeKeyPart } from "@/lib/dashboard/dedupe";
import {
  writeErr,
  writeOk,
  type DomainWriteResult,
} from "@/lib/supabase/write-result";
import { SITE_UTILITY_PROVIDERS } from "@/lib/utilities/providers";

const TABLE = "utility_accounts" as const;
const PAYMENTS = "utility_payment_logs" as const;

export async function listUtilityAccounts(supabase: SupabaseClient) {
  return supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .returns<UtilityAccount[]>();
}

export async function getUtilityAccount(supabase: SupabaseClient, id: string) {
  return supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle()
    .returns<UtilityAccount>();
}

/** Ensure the five fixed site providers exist (safe to call on page load). */
export async function ensureSiteUtilityAccounts(supabase: SupabaseClient) {
  const { data: existing, error } = await listUtilityAccounts(supabase);
  if (error) return { error, data: null as UtilityAccount[] | null };

  const byProvider = new Map(
    (existing ?? []).map((r) => [
      normalizeKeyPart(r.provider),
      r,
    ]),
  );

  for (const p of SITE_UTILITY_PROVIDERS) {
    const key = normalizeKeyPart(p.label);
    if (byProvider.has(key)) continue;
    const { data, error: insertError } = await supabase
      .from(TABLE)
      .insert({
        utility_type: p.utility_type,
        provider: p.label,
        billing_cycle: p.billing_cycle,
        notes: `Site ${p.label} bill. Next due = last paid + 1 month.`,
      } satisfies UtilityAccountInsert)
      .select("*")
      .single<UtilityAccount>();
    if (insertError) return { error: insertError, data: null };
    if (data) byProvider.set(key, data);
  }

  return listUtilityAccounts(supabase);
}

async function findUtilityDuplicate(
  supabase: SupabaseClient,
  input: UtilityAccountInsert,
): Promise<UtilityAccount | null> {
  const typeKey = normalizeKeyPart(input.utility_type);
  const accountKey = normalizeKeyPart(input.account_number);
  const providerKey = normalizeKeyPart(input.provider);
  if (!typeKey) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .ilike("utility_type", input.utility_type.trim())
    .returns<UtilityAccount[]>();
  if (error || !data?.length) return null;

  return (
    data.find((r) => {
      if (normalizeKeyPart(r.utility_type) !== typeKey) return false;
      if (accountKey) {
        return normalizeKeyPart(r.account_number) === accountKey;
      }
      return providerKey
        ? normalizeKeyPart(r.provider) === providerKey
        : false;
    }) ?? null
  );
}

export async function createUtilityAccount(
  supabase: SupabaseClient,
  input: UtilityAccountInsert,
): Promise<DomainWriteResult<UtilityAccount>> {
  const existing = await findUtilityDuplicate(supabase, input);
  if (existing) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<UtilityAccount>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select("*")
    .single<UtilityAccount>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateUtilityAccount(
  supabase: SupabaseClient,
  id: string,
  input: UtilityAccountUpdate,
) {
  return supabase.from(TABLE).update(input).eq("id", id).select("*").single();
}

export async function deleteUtilityAccount(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(TABLE).delete().eq("id", id);
}

export async function listUtilityPaymentLogs(
  supabase: SupabaseClient,
  utilityAccountId?: string,
) {
  let q = supabase
    .from(PAYMENTS)
    .select("*")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (utilityAccountId) {
    q = q.eq("utility_account_id", utilityAccountId);
  }
  return q.returns<UtilityPaymentLog[]>();
}

export async function createUtilityPaymentLog(
  supabase: SupabaseClient,
  input: UtilityPaymentLogInsert,
): Promise<DomainWriteResult<UtilityPaymentLog>> {
  const { data, error } = await supabase
    .from(PAYMENTS)
    .insert(input)
    .select("*")
    .single<UtilityPaymentLog>();
  if (error) return writeErr(error.message);

  // Keep monthly_avg_cost loosely in sync when amount is provided
  if (input.amount != null) {
    await supabase
      .from(TABLE)
      .update({ monthly_avg_cost: input.amount })
      .eq("id", input.utility_account_id);
  }

  return writeOk(data, "created");
}

export async function deleteUtilityPaymentLog(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(PAYMENTS).delete().eq("id", id);
}
