import { createClient } from "@/lib/supabase/server";
import {
  listTenantElectricBills,
  listTenants,
} from "@/lib/supabase/tenants";
import { TenantElectricityPanel } from "@/components/dashboard/tenant-electricity-panel";
import type { Tenant, TenantElectricBill } from "@/lib/types/database";

export default async function TenantElectricityPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: tenantParam } = await searchParams;
  const supabase = await createClient();
  const [tenants, bills] = await Promise.all([
    listTenants(supabase),
    listTenantElectricBills(supabase),
  ]);

  if (tenants.error || bills.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load tenant electricity bills:{" "}
        {tenants.error?.message ?? bills.error?.message}. If this mentions a
        missing table, run migration{" "}
        <code>20260820100000_tenants.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <TenantElectricityPanel
      initialTenants={(tenants.data ?? []) as Tenant[]}
      initialBills={(bills.data ?? []) as TenantElectricBill[]}
      initialTenantId={tenantParam ?? null}
    />
  );
}
