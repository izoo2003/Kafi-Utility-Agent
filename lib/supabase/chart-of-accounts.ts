import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChartOfAccountsEntry,
  ChartOfAccountsEntryInsert,
  ChartOfAccountsEntryUpdate,
  ChartOfAccountsLedger,
} from "@/lib/types/database";
import {
  incomingShouldOverwrite,
  normalizeKeyPart,
} from "@/lib/dashboard/dedupe";
import { writeErr, writeOk, type DomainWriteResult } from "@/lib/supabase/write-result";

const TABLE = "chart_of_accounts_entries" as const;

export async function listChartOfAccountsEntries(
  supabase: SupabaseClient,
  ledger?: ChartOfAccountsLedger | null,
) {
  let query = supabase.from(TABLE).select("*");
  if (ledger) {
    query = query.eq("ledger", ledger);
  }
  return query
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<ChartOfAccountsEntry[]>();
}

export async function getChartOfAccountsEntry(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle<ChartOfAccountsEntry>();
}

function entryMatchKey(row: {
  ledger: string;
  entry_date: string;
  ref_no: string | null;
  account_description: string | null;
  document_no: string | null;
  debit: number | null;
  credit: number | null;
}) {
  return [
    row.ledger,
    row.entry_date,
    normalizeKeyPart(row.ref_no),
    normalizeKeyPart(row.account_description),
    normalizeKeyPart(row.document_no),
    String(Number(row.debit) || 0),
    String(Number(row.credit) || 0),
  ].join("|");
}

export async function createChartOfAccountsEntry(
  supabase: SupabaseClient,
  input: ChartOfAccountsEntryInsert,
): Promise<DomainWriteResult<ChartOfAccountsEntry>> {
  const incomingKey = entryMatchKey({
    ledger: input.ledger,
    entry_date: input.entry_date,
    ref_no: input.ref_no ?? null,
    account_description: input.account_description ?? null,
    document_no: input.document_no ?? null,
    debit: input.debit ?? 0,
    credit: input.credit ?? 0,
  });

  const { data: matches, error: findError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("ledger", input.ledger)
    .eq("entry_date", input.entry_date)
    .returns<ChartOfAccountsEntry[]>();
  if (findError) return writeErr(findError.message);

  const existing =
    matches?.find((r) => entryMatchKey(r) === incomingKey) ?? null;

  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: input.entry_date,
      existingDate: existing.entry_date,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) return writeOk(existing, "skipped");
    const { data, error } = await supabase
      .from(TABLE)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<ChartOfAccountsEntry>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select("*")
    .single<ChartOfAccountsEntry>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateChartOfAccountsEntry(
  supabase: SupabaseClient,
  id: string,
  input: ChartOfAccountsEntryUpdate,
) {
  return supabase
    .from(TABLE)
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
}

export async function deleteChartOfAccountsEntry(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(TABLE).delete().eq("id", id);
}

export { withRunningBalances } from "@/lib/chart-of-accounts/balance";
