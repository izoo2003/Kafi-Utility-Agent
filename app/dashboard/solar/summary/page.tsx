import { createClient } from "@/lib/supabase/server";
import { resolveSolarSiteId } from "@/lib/dashboard/solar-site-nav";
import {
  getSolarSite,
  isSemsConfigured,
  listSolarSitesPublic,
} from "@/lib/sems/config";
import { currentSiteMonth } from "@/lib/solar/energy-summary";
import { PageHeader } from "@/components/dashboard/page-header";
import { SolarSectionNav } from "@/components/dashboard/solar-section-nav";
import { SolarEnergySummaryPanel } from "@/components/dashboard/solar-energy-summary-panel";

export default async function SolarEnergySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const sites = listSolarSitesPublic();
  const defaultSite = sites[0]?.id ?? "";
  const initialSiteId = resolveSolarSiteId(params.site, sites, defaultSite);
  let initialMonth = new Date().toISOString().slice(0, 7);
  try {
    const config = getSolarSite(initialSiteId);
    if (config) initialMonth = currentSiteMonth(config.timeZone);
  } catch {
    /* keep UTC month */
  }

  await createClient();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Solar · Energy Summary"
        description="Monthly generated, consumed, and grid-exported units with comparison and AI analysis."
        icon="solar"
        accent="teal"
      />

      <SolarSectionNav active="summary" sites={sites} />

      {isSemsConfigured() ? (
        <SolarEnergySummaryPanel
          sites={sites}
          initialSiteId={initialSiteId}
          initialMonth={initialMonth}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Configure SEMS+ credentials to view the solar energy summary.
        </p>
      )}
    </div>
  );
}
