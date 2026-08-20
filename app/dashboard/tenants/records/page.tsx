import { createClient } from "@/lib/supabase/server";
import { listTenantRentLogs, listTenants } from "@/lib/supabase/tenants";
import { TenantRecordsPanel } from "@/components/dashboard/tenant-records-panel";
import type { Tenant, TenantRentLog } from "@/lib/types/database";

export default async function TenantRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: tenantParam } = await searchParams;
  const supabase = await createClient();
  const [tenants, logs] = await Promise.all([
    listTenants(supabase),
    listTenantRentLogs(supabase),
  ]);

  if (tenants.error || logs.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load tenant rent records:{" "}
        {tenants.error?.message ?? logs.error?.message}. If this mentions a
        missing table, run migration{" "}
        <code>20260820100000_tenants.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <TenantRecordsPanel
      initialTenants={(tenants.data ?? []) as Tenant[]}
      initialLogs={(logs.data ?? []) as TenantRentLog[]}
      initialTenantId={tenantParam ?? null}
    />
  );
}
