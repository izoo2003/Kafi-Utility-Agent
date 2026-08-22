import { createClient } from "@/lib/supabase/server";
import { resolveSolarSiteId } from "@/lib/dashboard/solar-site-nav";
import { listSolarSitesPublic } from "@/lib/sems/config";
import {
  listSolarMonitoringLog,
  listSolarSpecs,
} from "@/lib/supabase/solar";
import { SolarPanel } from "@/components/dashboard/solar-panel";
import type { SolarMonitoringLog, SolarSpecs } from "@/lib/types/database";

export default async function SolarPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const sites = listSolarSitesPublic();
  const defaultSite = sites[0]?.id ?? "";
  const initialSiteId = resolveSolarSiteId(params.site, sites, defaultSite);
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
      sites={sites}
      initialSiteId={initialSiteId}
      initialSpecs={(specs.data ?? []) as SolarSpecs[]}
      initialLogs={(logs.data ?? []) as SolarMonitoringLog[]}
    />
  );
}
