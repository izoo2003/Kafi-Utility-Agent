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
  GeneratorRunLog,
  GeneratorRunLogInsert,
  GeneratorRunLogUpdate,
  GeneratorVendor,
  GeneratorVendorInsert,
  GeneratorVendorUpdate,
} from "@/lib/types/database";
import {
  incomingShouldOverwrite,
  normalizeKeyPart,
} from "@/lib/dashboard/dedupe";
import { writeErr, writeOk, type DomainWriteResult } from "@/lib/supabase/write-result";

const MAINTENANCE = "generator_maintenance" as const;
const FUEL = "generator_fuel_log" as const;
const RUNS = "generator_run_log" as const;
const EXPENSES = "generator_expenses" as const;
const VENDORS = "generator_vendors" as const;

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
  const { data, error } = await supabase
    .from(MAINTENANCE)
    .select("*")
    .eq("service_date", input.service_date)
    .order("updated_at", { ascending: false })
    .returns<GeneratorMaintenance[]>();
  if (error || !data?.length) return null;
  return data[0] ?? null;
}

export async function createGeneratorMaintenance(
  supabase: SupabaseClient,
  input: GeneratorMaintenanceInsert,
): Promise<DomainWriteResult<GeneratorMaintenance>> {
  const existing = await findMaintenanceDuplicate(supabase, input);
  if (existing) {
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

export async function listGeneratorRunLog(supabase: SupabaseClient) {
  return supabase
    .from(RUNS)
    .select("*")
    .order("run_date", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<GeneratorRunLog[]>();
}

export async function createGeneratorRunLog(
  supabase: SupabaseClient,
  input: GeneratorRunLogInsert,
): Promise<DomainWriteResult<GeneratorRunLog>> {
  const { data: matches, error: findError } = await supabase
    .from(RUNS)
    .select("*")
    .eq("run_date", input.run_date)
    .order("updated_at", { ascending: false })
    .returns<GeneratorRunLog[]>();
  if (findError) return writeErr(findError.message);

  const existing = matches?.[0] ?? null;
  if (existing) {
    const { data, error } = await supabase
      .from(RUNS)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<GeneratorRunLog>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(RUNS)
    .insert(input)
    .select("*")
    .single<GeneratorRunLog>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateGeneratorRunLog(
  supabase: SupabaseClient,
  id: string,
  input: GeneratorRunLogUpdate,
) {
  return supabase.from(RUNS).update(input).eq("id", id).select("*").single();
}

export async function deleteGeneratorRunLog(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(RUNS).delete().eq("id", id);
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

export async function listGeneratorVendors(supabase: SupabaseClient) {
  return supabase
    .from(VENDORS)
    .select("*")
    .order("name", { ascending: true })
    .returns<GeneratorVendor[]>();
}

export async function getGeneratorVendor(
  supabase: SupabaseClient,
  id: string,
) {
  const { data, error } = await supabase
    .from(VENDORS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: (data as GeneratorVendor | null) ?? null, error };
}

export async function findGeneratorVendorByName(
  supabase: SupabaseClient,
  name: string,
): Promise<GeneratorVendor | null> {
  const key = normalizeKeyPart(name);
  if (!key) return null;
  const { data, error } = await supabase
    .from(VENDORS)
    .select("*")
    .ilike("name", name.trim())
    .returns<GeneratorVendor[]>();
  if (error || !data?.length) {
    const all = await listGeneratorVendors(supabase);
    if (all.error || !all.data?.length) return null;
    return (
      all.data.find((r) => normalizeKeyPart(r.name) === key) ?? null
    );
  }
  return (
    data.find((r) => normalizeKeyPart(r.name) === key) ?? data[0] ?? null
  );
}

export async function createGeneratorVendor(
  supabase: SupabaseClient,
  input: GeneratorVendorInsert,
): Promise<DomainWriteResult<GeneratorVendor>> {
  const existing = await findGeneratorVendorByName(supabase, input.name);
  if (existing) {
    const { data, error } = await supabase
      .from(VENDORS)
      .update(input)
      .eq("id", existing.id)
      .select("*")
      .single<GeneratorVendor>();
    if (error) return writeErr(error.message);
    return writeOk(data, "updated");
  }

  const { data, error } = await supabase
    .from(VENDORS)
    .insert(input)
    .select("*")
    .single<GeneratorVendor>();
  if (error) return writeErr(error.message);
  return writeOk(data, "created");
}

export async function updateGeneratorVendor(
  supabase: SupabaseClient,
  id: string,
  input: GeneratorVendorUpdate,
) {
  return supabase
    .from(VENDORS)
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
}

export async function deleteGeneratorVendor(
  supabase: SupabaseClient,
  id: string,
) {
  return supabase.from(VENDORS).delete().eq("id", id);
}

export async function getGeneratorRunLog(
  supabase: SupabaseClient,
  id: string,
) {
  const { data, error } = await supabase
    .from(RUNS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: (data as GeneratorRunLog | null) ?? null, error };
}
