import { createClient } from "@/lib/supabase/server";
import { listGeneratorFuelLog } from "@/lib/supabase/generator";
import { GeneratorPanel } from "@/components/dashboard/generator-panel";
import type { GeneratorFuelLog } from "@/lib/types/database";

export default async function GeneratorFuelPage() {
  const supabase = await createClient();
  const { data, error } = await listGeneratorFuelLog(supabase);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load generator fuel log: {error.message}
      </p>
    );
  }

  return (
    <GeneratorPanel
      section="fuel"
      initialFuel={(data ?? []) as GeneratorFuelLog[]}
    />
  );
}
