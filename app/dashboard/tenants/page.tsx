import { createClient } from "@/lib/supabase/server";
import { listTenantSummaries } from "@/lib/supabase/tenants";
import { ensureFilerWithholdingSlabs } from "@/lib/supabase/withholding-tax-slabs";
import { TenantListPanel } from "@/components/dashboard/tenant-list-panel";

export default async function TenantsPage() {
  const supabase = await createClient();
  await ensureFilerWithholdingSlabs(supabase);
  const { data, error } = await listTenantSummaries(supabase);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load tenants: {error.message}. If this mentions a missing
        table, run migration{" "}
        <code>20260903210000_tenant_contract_ledger.sql</code> in Supabase.
      </p>
    );
  }

  return <TenantListPanel initialItems={data ?? []} />;
}
