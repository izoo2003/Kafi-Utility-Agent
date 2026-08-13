import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  UtilityAccount,
  UtilityAccountInsert,
  UtilityAccountUpdate,
} from "@/lib/types/database";

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

export async function createUtilityAccount(
  supabase: SupabaseClient,
  input: UtilityAccountInsert,
) {
  return supabase.from(TABLE).insert(input).select("*").single();
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
