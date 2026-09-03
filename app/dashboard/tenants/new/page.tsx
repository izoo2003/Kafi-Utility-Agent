import { PageHeader } from "@/components/dashboard/page-header";
import { TenantForm } from "@/components/dashboard/tenant-form";

export default function NewTenantPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add tenant"
        description="Name, survey, contract dates, deposit, rent terms, and optional extra monthly charges."
        icon="tenants"
        accent="violet"
      />
      <TenantForm />
    </div>
  );
}
