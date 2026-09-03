import { redirect } from "next/navigation";

export default async function TenantRecordsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant } = await searchParams;
  if (tenant) redirect(`/dashboard/tenants/${tenant}`);
  redirect("/dashboard/tenants");
}
