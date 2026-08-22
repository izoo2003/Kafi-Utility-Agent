import { createClient } from "@/lib/supabase/server";
import { resolveSolarSiteId } from "@/lib/dashboard/solar-site-nav";
import {
  getSolarSite,
  isSemsConfigured,
  listSolarSitesPublic,
} from "@/lib/sems/config";
import { getSolarLiveSnapshot } from "@/lib/supabase/solar";
import { evaluateSnapshotAlerts } from "@/lib/sems/alert-rules";
import { PageHeader } from "@/components/dashboard/page-header";
import { SolarSectionNav } from "@/components/dashboard/solar-section-nav";
import { SolarLivePanel } from "@/components/dashboard/solar-live-panel";
import type { SolarLiveSnapshot } from "@/lib/types/database";

export default async function SolarSemsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const sites = listSolarSitesPublic();
  const defaultSite = sites[0]?.id ?? "";
  const initialSiteId = resolveSolarSiteId(params.site, sites, defaultSite);
  const supabase = await createClient();
  const site = getSolarSite(initialSiteId);
  const live = site
    ? await getSolarLiveSnapshot(supabase, site.stationId)
    : { data: null, error: null };

  const liveSnapshot =
    live.error &&
    /solar_live_snapshot|does not exist|schema cache/i.test(live.error.message)
      ? null
      : ((live.data ?? null) as SolarLiveSnapshot | null);

  if (
    live.error &&
    !/solar_live_snapshot|does not exist|schema cache/i.test(live.error.message)
  ) {
    return (
      <p className="text-sm text-destructive">
        Failed to load SEMS+ snapshot: {live.error.message}
      </p>
    );
  }

  const alerts = evaluateSnapshotAlerts(liveSnapshot);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Solar · SEMS+"
        description="Near-live GoodWe plant values from SEMS+ (polled). Auto-alerts fire when readings breach baselines."
        icon="solar"
        accent="teal"
      />

      <SolarSectionNav active="sems" sites={sites} />

      <SolarLivePanel
        sites={sites}
        initialSiteId={initialSiteId}
        initialSnapshot={liveSnapshot}
        initialAlerts={alerts}
        configured={isSemsConfigured()}
      />
    </div>
  );
}
