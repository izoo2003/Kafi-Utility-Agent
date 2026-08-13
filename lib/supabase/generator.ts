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

export async function createGeneratorMaintenance(
  supabase: SupabaseClient,
  input: GeneratorMaintenanceInsert,
) {
  return supabase.from(MAINTENANCE).insert(input).select("*").single();
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
) {
  return supabase.from(FUEL).insert(input).select("*").single();
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

export async function createGeneratorExpense(
  supabase: SupabaseClient,
  input: GeneratorExpenseInsert,
) {
  return supabase.from(EXPENSES).insert(input).select("*").single();
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
