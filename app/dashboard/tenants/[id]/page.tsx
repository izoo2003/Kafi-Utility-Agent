import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getTenantLedger,
  listTenantElectricBills,
} from "@/lib/supabase/tenants";
import { PageHeader } from "@/components/dashboard/page-header";
import { TenantDetailHeader } from "@/components/dashboard/tenant-detail-header";
import { TenantDetailTabs } from "@/components/dashboard/tenant-detail-tabs";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data, error }, bills] = await Promise.all([
    getTenantLedger(supabase, id),
    listTenantElectricBills(supabase, id),
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={data.tenant.tenant_name}
          description="Contract summary, monthly rent ledger, and electricity bills."
          icon="tenants"
          accent="violet"
        />
        <div className="flex shrink-0 flex-wrap gap-2">
          <ExportButtons resource="tenant-rent" />
          <Link
            href="/dashboard/tenants"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            All tenants
          </Link>
        </div>
      </div>
      <TenantDetailHeader tenant={data.tenant} lineItems={data.line_items} />
      <TenantDetailTabs
        tenant={data.tenant}
        schedule={data.schedule}
        bills={(bills.data ?? []).filter((b) => b.tenant_id === id)}
      />
    </div>
  );
}
