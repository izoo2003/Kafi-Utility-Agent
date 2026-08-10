import { createClient } from "@/lib/supabase/server";
import { listItEquipment } from "@/lib/supabase/it-equipment";
import { ItEquipmentPanel } from "@/components/dashboard/it-equipment-panel";
import type { ItEquipment } from "@/lib/types/database";

export default async function ItEquipmentPage() {
  const supabase = await createClient();
  const { data, error } = await listItEquipment(supabase);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load IT equipment: {error.message}
      </p>
    );
  }

  return <ItEquipmentPanel initialItems={(data ?? []) as ItEquipment[]} />;
}
