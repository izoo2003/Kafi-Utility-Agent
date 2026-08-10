import { createClient } from "@/lib/supabase/server";
import {
  listGeneratorFuelLog,
  listGeneratorMaintenance,
} from "@/lib/supabase/generator";
import { GeneratorPanel } from "@/components/dashboard/generator-panel";
import type {
  GeneratorFuelLog,
  GeneratorMaintenance,
} from "@/lib/types/database";

export default async function GeneratorPage() {
  const supabase = await createClient();
  const [maintenance, fuel] = await Promise.all([
    listGeneratorMaintenance(supabase),
    listGeneratorFuelLog(supabase),
  ]);

  if (maintenance.error || fuel.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load generator data:{" "}
        {maintenance.error?.message ?? fuel.error?.message}
      </p>
    );
  }

  return (
    <GeneratorPanel
      initialMaintenance={(maintenance.data ?? []) as GeneratorMaintenance[]}
      initialFuel={(fuel.data ?? []) as GeneratorFuelLog[]}
    />
  );
}
