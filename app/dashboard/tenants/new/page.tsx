import { createClient } from "@/lib/supabase/server";
import { ensureFilerWithholdingSlabs } from "@/lib/supabase/withholding-tax-slabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { TenantForm } from "@/components/dashboard/tenant-form";

export default async function NewTenantPage() {
  const supabase = await createClient();
  const slabs = await ensureFilerWithholdingSlabs(supabase);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add tenant"
        description="Name, survey, contract dates, deposit, rent terms, and optional extra monthly charges."
        icon="tenants"
        accent="violet"
      />
      <TenantForm slabs={slabs.data ?? []} />
    </div>
  );
}
