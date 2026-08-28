import { createClient } from "@/lib/supabase/server";
import {
  listGeneratorMaintenance,
  listGeneratorRunLog,
} from "@/lib/supabase/generator";
import { GeneratorPanel } from "@/components/dashboard/generator-panel";
import type {
  GeneratorMaintenance,
  GeneratorRunLog,
} from "@/lib/types/database";

export default async function GeneratorRunsPage() {
  const supabase = await createClient();
  const [runs, maintenance] = await Promise.all([
    listGeneratorRunLog(supabase),
    listGeneratorMaintenance(supabase),
  ]);

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
      section="runs"
      initialRuns={(runs.data ?? []) as GeneratorRunLog[]}
      initialMaintenance={(maintenance.data ?? []) as GeneratorMaintenance[]}
    />
  );
}
