import { createClient } from "@/lib/supabase/server";
import {
  listSolarMonitoringLog,
  listSolarSpecs,
} from "@/lib/supabase/solar";
import { SolarPanel } from "@/components/dashboard/solar-panel";
import type { SolarMonitoringLog, SolarSpecs } from "@/lib/types/database";

export default async function SolarPage() {
  const supabase = await createClient();
  const [specs, logs] = await Promise.all([
    listSolarSpecs(supabase),
    listSolarMonitoringLog(supabase),
  ]);

  if (specs.error || logs.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load solar data:{" "}
        {specs.error?.message ?? logs.error?.message}
      </p>
    );
  }

  return (
    <SolarPanel
      initialSpecs={(specs.data ?? []) as SolarSpecs[]}
      initialLogs={(logs.data ?? []) as SolarMonitoringLog[]}
    />
  );
}
