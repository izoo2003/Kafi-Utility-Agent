import { createClient } from "@/lib/supabase/server";
import { listWithholdingTaxSlabs } from "@/lib/supabase/withholding-tax-slabs";
import { WithholdingTaxSlabsPanel } from "@/components/dashboard/withholding-tax-slabs-panel";

export default async function WithholdingTaxSlabsPage() {
  const supabase = await createClient();
  const { data, error } = await listWithholdingTaxSlabs(supabase);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load withholding tax slabs: {error.message}. If this
        mentions a missing table, run migration{" "}
        <code>20260904130000_tenant_withholding_tax.sql</code> in Supabase.
      </p>
    );
  }

  return <WithholdingTaxSlabsPanel initialSlabs={data ?? []} />;
}
