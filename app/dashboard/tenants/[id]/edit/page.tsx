import { createClient } from "@/lib/supabase/server";
import { countSchedulePayments, getTenantLedger } from "@/lib/supabase/tenants";
import { ensureFilerWithholdingSlabs } from "@/lib/supabase/withholding-tax-slabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { TenantForm } from "@/components/dashboard/tenant-form";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data, error }, payments, slabs] = await Promise.all([
    getTenantLedger(supabase, id),
    countSchedulePayments(supabase, id),
    ensureFilerWithholdingSlabs(supabase),
  ]);

  if (error || !data?.tenant) {
    return (
      <p className="text-sm text-destructive">
        {error?.message ?? "Tenant not found."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${data.tenant.tenant_name}`}
        description="Updating contract dates or rent terms rebuilds the monthly ledger."
        icon="tenants"
        accent="violet"
      />
      <TenantForm
        tenant={data.tenant}
        lineItems={data.line_items}
        paymentCount={payments.count}
        slabs={slabs.data ?? []}
      />
    </div>
  );
}
