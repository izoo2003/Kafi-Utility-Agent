import { createClient } from "@/lib/supabase/server";
import { listSolarSitesPublic } from "@/lib/sems/config";
import { listSolarNetMeteringLogs } from "@/lib/supabase/solar-net-metering";
import { SolarNetMeteringPanel } from "@/components/dashboard/solar-net-metering-panel";
import type { SolarNetMeteringLog } from "@/lib/supabase/solar-net-metering";

export default async function SolarNetMeteringPage() {
  const supabase = await createClient();
  const sites = listSolarSitesPublic();
  const defaultSite = sites[0]?.id ?? "";

  const { data, error } = await listSolarNetMeteringLogs(supabase);

  if (
    error &&
    /solar_net_metering_logs|does not exist|schema cache/i.test(error.message)
  ) {
    return (
      <p className="text-sm text-destructive">
        Net metering table is missing — run migration{" "}
        <code>20260822140000_solar_net_metering.sql</code> in Supabase.
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load net metering ledger: {error.message}
      </p>
    );
  }

  return (
    <SolarNetMeteringPanel
      sites={sites}
      initialSiteId={defaultSite}
      initialLogs={(data ?? []) as SolarNetMeteringLog[]}
    />
  );
}
