import { createClient } from "@/lib/supabase/server";
import {
  getSolarSite,
  isSemsConfigured,
  listSolarSitesPublic,
} from "@/lib/sems/config";
import { currentSiteMonth } from "@/lib/solar/energy-summary";
import { PageHeader } from "@/components/dashboard/page-header";
import { SolarSectionNav } from "@/components/dashboard/solar-section-nav";
import { SolarEnergySummaryPanel } from "@/components/dashboard/solar-energy-summary-panel";

export default async function SolarEnergySummaryPage() {
  const sites = listSolarSitesPublic();
  const defaultSite = sites[0]?.id ?? "";
  let initialMonth = new Date().toISOString().slice(0, 7);
  try {
    const config = getSolarSite(defaultSite);
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

      <SolarSectionNav active="summary" />

      {isSemsConfigured() ? (
        <SolarEnergySummaryPanel
          sites={sites}
          initialSiteId={defaultSite}
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
