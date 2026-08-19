import { createClient } from "@/lib/supabase/server";
import { isSemsConfigured, getSemsConfig } from "@/lib/sems/config";
import { formatSiteDate } from "@/lib/sems/consumption-stats";
import { PageHeader } from "@/components/dashboard/page-header";
import { SolarSectionNav } from "@/components/dashboard/solar-section-nav";
import { SolarConsumptionPanel } from "@/components/dashboard/solar-consumption-panel";

export default async function SolarConsumptionPage() {
  let initialDate = new Date().toISOString().slice(0, 10);
  try {
    const config = getSemsConfig();
    if (config) initialDate = formatSiteDate(config.timeZone);
  } catch {
    /* keep UTC date */
  }

  // Ensure auth/session is established for the layout.
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
        <SolarConsumptionPanel initialDate={initialDate} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Configure SEMS+ credentials to view consumption monitoring.
        </p>
      )}
    </div>
  );
}
