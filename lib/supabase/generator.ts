import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GeneratorExpense,
  GeneratorExpenseInsert,
  GeneratorExpenseUpdate,
  GeneratorFuelLog,
  GeneratorFuelLogInsert,
  GeneratorFuelLogUpdate,
  GeneratorMaintenance,
  GeneratorMaintenanceInsert,
  GeneratorMaintenanceUpdate,
} from "@/lib/types/database";
import {
  incomingShouldOverwrite,
  normalizeKeyPart,
} from "@/lib/dashboard/dedupe";
import { writeErr, writeOk, type DomainWriteResult } from "@/lib/supabase/write-result";

const MAINTENANCE = "generator_maintenance" as const;
const FUEL = "generator_fuel_log" as const;
const EXPENSES = "generator_expenses" as const;

export async function listGeneratorMaintenance(supabase: SupabaseClient) {
  return supabase
    .from(MAINTENANCE)
    .select("*")
    .order("created_at", { ascending: false })
    .returns<GeneratorMaintenance[]>();
}

async function findMaintenanceDuplicate(
  supabase: SupabaseClient,
  input: GeneratorMaintenanceInsert,
): Promise<GeneratorMaintenance | null> {
  const typeKey = normalizeKeyPart(input.service_type);
  const { data, error } = await supabase
    .from(MAINTENANCE)
    .select("*")
    .eq("service_date", input.service_date)
    .returns<GeneratorMaintenance[]>();
  if (error || !data?.length) return null;
  if (!typeKey) {
    return (
      [...data].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ??
      null
    );
  }
  return (
    data.find((r) => normalizeKeyPart(r.service_type) === typeKey) ?? null
  );
}

export async function createGeneratorMaintenance(
  supabase: SupabaseClient,
  input: GeneratorMaintenanceInsert,
): Promise<DomainWriteResult<GeneratorMaintenance>> {
  const existing = await findMaintenanceDuplicate(supabase, input);
  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: input.service_date,
      existingDate: existing.service_date,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) return writeOk(existing, "skipped");
    const { data, error } = await supabase
      .from(MAINTENANCE)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<GeneratorMaintenance>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(MAINTENANCE)
    .insert(input)
    .select("*")
    .single<GeneratorMaintenance>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateGeneratorMaintenance(
  supabase: SupabaseClient,
  id: string,
  input: GeneratorMaintenanceUpdate,
) {
  return supabase
    .from(MAINTENANCE)
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
}

export async function deleteGeneratorMaintenance(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(MAINTENANCE).delete().eq("id", id);
}

export async function listGeneratorFuelLog(supabase: SupabaseClient) {
  return supabase
    .from(FUEL)
    .select("*")
    .order("created_at", { ascending: false })
    .returns<GeneratorFuelLog[]>();
}

export async function createGeneratorFuelLog(
  supabase: SupabaseClient,
  input: GeneratorFuelLogInsert,
): Promise<DomainWriteResult<GeneratorFuelLog>> {
  const { data: matches, error: findError } = await supabase
    .from(FUEL)
    .select("*")
    .eq("log_date", input.log_date)
    .order("updated_at", { ascending: false })
    .returns<GeneratorFuelLog[]>();
  if (findError) return writeErr(findError.message);

  const existing = matches?.[0] ?? null;
  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: input.log_date,
      existingDate: existing.log_date,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) return writeOk(existing, "skipped");
    const { data, error } = await supabase
      .from(FUEL)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<GeneratorFuelLog>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(FUEL)
    .insert(input)
    .select("*")
    .single<GeneratorFuelLog>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateGeneratorFuelLog(
  supabase: SupabaseClient,
  id: string,
  input: GeneratorFuelLogUpdate,
) {
  return supabase.from(FUEL).update(input).eq("id", id).select("*").single();
}

export async function deleteGeneratorFuelLog(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(FUEL).delete().eq("id", id);
}

export async function listGeneratorExpenses(supabase: SupabaseClient) {
  return supabase
    .from(EXPENSES)
    .select("*")
    .order("created_at", { ascending: false })
    .returns<GeneratorExpense[]>();
}

function expenseMatchKey(row: {
  expense_date: string;
  account: string | null;
  description: string | null;
  debit: number | null;
}) {
  return [
    row.expense_date,
    normalizeKeyPart(row.account),
    normalizeKeyPart(row.description),
    String(Number(row.debit) || 0),
  ].join("|");
}

export async function createGeneratorExpense(
  supabase: SupabaseClient,
  input: GeneratorExpenseInsert,
): Promise<DomainWriteResult<GeneratorExpense>> {
  const incomingKey = expenseMatchKey({
    expense_date: input.expense_date,
    account: input.account ?? null,
    description: input.description ?? null,
    debit: input.debit ?? 0,
  });

  const { data: matches, error: findError } = await supabase
    .from(EXPENSES)
    .select("*")
    .eq("expense_date", input.expense_date)
    .returns<GeneratorExpense[]>();
  if (findError) return writeErr(findError.message);

  const existing =
    matches?.find((r) => expenseMatchKey(r) === incomingKey) ?? null;

  if (existing) {
    const overwrite = incomingShouldOverwrite({
      incomingDate: input.expense_date,
      existingDate: existing.expense_date,
      existingUpdatedAt: existing.updated_at,
    });
    if (!overwrite) return writeOk(existing, "skipped");
    const { data, error } = await supabase
      .from(EXPENSES)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<GeneratorExpense>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(EXPENSES)
    .insert(input)
    .select("*")
    .single<GeneratorExpense>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateGeneratorExpense(
  supabase: SupabaseClient,
  id: string,
  input: GeneratorExpenseUpdate,
) {
  return supabase
    .from(EXPENSES)
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
}

export async function deleteGeneratorExpense(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(EXPENSES).delete().eq("id", id);
}
