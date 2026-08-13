import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  UtilityAccount,
  UtilityAccountInsert,
  UtilityAccountUpdate,
} from "@/lib/types/database";
import { normalizeKeyPart } from "@/lib/dashboard/dedupe";
import { writeErr, writeOk, type DomainWriteResult } from "@/lib/supabase/write-result";

const TABLE = "utility_accounts" as const;

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
    // Same account identity: always refresh with incoming (no date column)
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
