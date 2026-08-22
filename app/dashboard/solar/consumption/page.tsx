import { createClient } from "@/lib/supabase/server";
import {
  getSolarSite,
  isSemsConfigured,
  listSolarSitesPublic,
} from "@/lib/sems/config";
import { formatSiteDate } from "@/lib/sems/consumption-stats";
import { PageHeader } from "@/components/dashboard/page-header";
import { SolarSectionNav } from "@/components/dashboard/solar-section-nav";
import { SolarConsumptionPanel } from "@/components/dashboard/solar-consumption-panel";

export default async function SolarConsumptionPage() {
  const sites = listSolarSitesPublic();
  const defaultSite = sites[0]?.id ?? "";
  let initialDate = new Date().toISOString().slice(0, 10);
  try {
    const config = getSolarSite(defaultSite);
    if (config) initialDate = formatSiteDate(config.timeZone);
  } catch {
    /* keep UTC date */
  }

  await createClient();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Solar · Consumption"
        description="Day / week / month / year generation and consumption — To Load vs To Grid, From PV&BAT vs From Grid (SEMS+)."
        icon="solar"
        accent="teal"
      />

      <SolarSectionNav active="consumption" />

      {isSemsConfigured() ? (
        <SolarConsumptionPanel
          sites={sites}
          initialSiteId={defaultSite}
          initialDate={initialDate}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Configure SEMS+ credentials to view consumption monitoring.
        </p>
      )}
    </div>
  );
}
