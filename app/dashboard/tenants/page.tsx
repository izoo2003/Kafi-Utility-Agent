import { createClient } from "@/lib/supabase/server";
import { listTenants } from "@/lib/supabase/tenants";
import { TenantsPanel } from "@/components/dashboard/tenants-panel";
import type { Tenant } from "@/lib/types/database";

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data, error } = await listTenants(supabase);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load tenants: {error.message}. If this mentions a missing
        table, run migration{" "}
        <code>20260820100000_tenants.sql</code> in Supabase.
      </p>
    );
  }

  return <TenantsPanel initialItems={(data ?? []) as Tenant[]} />;
}
