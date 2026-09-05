import { createClient } from "@/lib/supabase/server";
import { listTenants } from "@/lib/supabase/tenants";
import { listTenantBrokers } from "@/lib/supabase/tenant-brokers";
import { TenantBrokersPanel } from "@/components/dashboard/tenant-brokers-panel";

export default async function TenantBrokersPage() {
  const supabase = await createClient();
  const [brokers, tenants] = await Promise.all([
    listTenantBrokers(supabase),
    listTenants(supabase),
  ]);

  if (brokers.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load brokers: {brokers.error.message}. If this mentions a
        missing table, run{" "}
        <code>scripts/apply-tenant-brokers-migration.mjs</code>.
      </p>
    );
  }
  if (tenants.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load tenants: {tenants.error.message}.
      </p>
    );
  }

  return (
    <TenantBrokersPanel
      initialItems={brokers.data ?? []}
      tenants={tenants.data ?? []}
    />
  );
}
