import { createClient } from "@/lib/supabase/server";
import { resolveSolarSiteId } from "@/lib/dashboard/solar-site-nav";
import { listSolarSitesPublic } from "@/lib/sems/config";
import { listSolarMaintenance } from "@/lib/supabase/solar";
import { SolarServicePanel } from "@/components/dashboard/solar-service-panel";
import type { SolarMaintenance } from "@/lib/types/database";

export default async function SolarServicePage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const sites = listSolarSitesPublic();
  const defaultSite = sites[0]?.id ?? "";
  const initialSiteId = resolveSolarSiteId(params.site, sites, defaultSite);
  const supabase = await createClient();
  const maintenance = await listSolarMaintenance(supabase);

  if (maintenance.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load solar service records: {maintenance.error.message}. Run
        migration{" "}
        <code>20260831120000_solar_maintenance.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <SolarServicePanel
      sites={sites}
      initialSiteId={initialSiteId}
      initialRows={(maintenance.data ?? []) as SolarMaintenance[]}
    />
  );
}
