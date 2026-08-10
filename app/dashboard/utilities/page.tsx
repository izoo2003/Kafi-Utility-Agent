import { createClient } from "@/lib/supabase/server";
import { listUtilityAccounts } from "@/lib/supabase/utilities";
import { UtilitiesPanel } from "@/components/dashboard/utilities-panel";
import type { UtilityAccount } from "@/lib/types/database";

export default async function UtilitiesPage() {
  const supabase = await createClient();
  const { data, error } = await listUtilityAccounts(supabase);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load utilities: {error.message}
      </p>
    );
  }

  return (
    <UtilitiesPanel initialItems={(data ?? []) as UtilityAccount[]} />
  );
}
