import { createClient } from "@/lib/supabase/server";
import { listAppliances } from "@/lib/supabase/appliances";
import { AppliancesPanel } from "@/components/dashboard/appliances-panel";
import type { Appliance, ApplianceSite } from "@/lib/types/database";
import { applianceSiteMeta } from "@/lib/dashboard/appliance-sites";

export async function AppliancesSitePage({ site }: { site: ApplianceSite }) {
  const supabase = await createClient();
  const { data, error } = await listAppliances(supabase, site);
  const meta = applianceSiteMeta(site);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load {meta.label} appliances: {error.message}
      </p>
    );
  }

  return (
    <AppliancesPanel
      site={site}
      initialItems={(data ?? []) as Appliance[]}
    />
  );
}
