import { createClient } from "@/lib/supabase/server";
import { listKitchenInventory } from "@/lib/supabase/kitchen-inventory";
import { KitchenInventoryPanel } from "@/components/dashboard/kitchen-inventory-panel";
import type { KitchenInventory } from "@/lib/types/database";

export default async function KitchenInventoryPage() {
  const supabase = await createClient();
  const { data, error } = await listKitchenInventory(supabase);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load kitchen inventory: {error.message}
      </p>
    );
  }

  return (
    <KitchenInventoryPanel
      initialItems={(data ?? []) as KitchenInventory[]}
    />
  );
}
