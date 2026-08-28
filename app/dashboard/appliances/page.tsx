import { createClient } from "@/lib/supabase/server";
import { listAppliances } from "@/lib/supabase/appliances";
import { AppliancesPanel } from "@/components/dashboard/appliances-panel";
import type { Appliance } from "@/lib/types/database";

export default async function AppliancesPage() {
  const supabase = await createClient();
  const { data, error } = await listAppliances(supabase);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load appliances: {error.message}
      </p>
    );
  }

  return <AppliancesPanel initialItems={(data ?? []) as Appliance[]} />;
}
