import { createClient } from "@/lib/supabase/server";
import {
  listGeneratorExpenses,
  listGeneratorFuelLog,
  listGeneratorMaintenance,
  listGeneratorRunLog,
} from "@/lib/supabase/generator";
import { GeneratorPanel } from "@/components/dashboard/generator-panel";
import type {
  GeneratorExpense,
  GeneratorFuelLog,
  GeneratorMaintenance,
  GeneratorRunLog,
} from "@/lib/types/database";

export default async function GeneratorPage() {
  const supabase = await createClient();
  const [maintenance, fuel, expenses, runs] = await Promise.all([
    listGeneratorMaintenance(supabase),
    listGeneratorFuelLog(supabase),
    listGeneratorExpenses(supabase),
    listGeneratorRunLog(supabase),
  ]);

  if (maintenance.error || fuel.error || expenses.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load generator data:{" "}
        {maintenance.error?.message ??
          fuel.error?.message ??
          expenses.error?.message}
      </p>
    );
  }

  if (runs.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load generator run log: {runs.error.message}. Run migration{" "}
        <code>20260813191000_generator_run_log.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <GeneratorPanel
      initialMaintenance={(maintenance.data ?? []) as GeneratorMaintenance[]}
      initialFuel={(fuel.data ?? []) as GeneratorFuelLog[]}
      initialExpenses={(expenses.data ?? []) as GeneratorExpense[]}
      initialRuns={(runs.data ?? []) as GeneratorRunLog[]}
    />
  );
}
