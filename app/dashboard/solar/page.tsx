import { createClient } from "@/lib/supabase/server";
import { resolveSolarSiteId } from "@/lib/dashboard/solar-site-nav";
import { listSolarSitesPublic } from "@/lib/sems/config";
import {
  listSolarMaintenance,
  listSolarMonitoringLog,
  listSolarSpecs,
} from "@/lib/supabase/solar";
import { SolarPanel } from "@/components/dashboard/solar-panel";
import type {
  SolarMaintenance,
  SolarMonitoringLog,
  SolarSpecs,
} from "@/lib/types/database";

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
  const [specs, logs, maintenance] = await Promise.all([
    listSolarSpecs(supabase),
    listSolarMonitoringLog(supabase),
    listSolarMaintenance(supabase),
  ]);

  if (specs.error || logs.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load solar data:{" "}
        {specs.error?.message ?? logs.error?.message}
      </p>
    );
  }

  const maintenanceMissing =
    !!maintenance.error &&
    /solar_maintenance|does not exist|schema cache/i.test(
      maintenance.error.message,
    );

  return (
    <SolarPanel
      sites={sites}
      initialSiteId={initialSiteId}
      initialSpecs={(specs.data ?? []) as SolarSpecs[]}
      initialLogs={(logs.data ?? []) as SolarMonitoringLog[]}
      initialMaintenance={
        maintenanceMissing || maintenance.error
          ? []
          : ((maintenance.data ?? []) as SolarMaintenance[])
      }
      maintenanceError={
        maintenance.error && !maintenanceMissing
          ? maintenance.error.message
          : maintenanceMissing
            ? "Service logs table is missing — run migration 20260831120000_solar_maintenance.sql."
            : null
      }
    />
  );
}
