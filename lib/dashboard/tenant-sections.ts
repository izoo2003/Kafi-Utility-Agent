export const tenantSections = [
  {
    value: "create",
    href: "/dashboard/tenants",
    label: "Create tenant",
    description: "Add and manage tenant accounts and current rent details",
  },
  {
    value: "records",
    href: "/dashboard/tenants/records",
    label: "Rent records",
    description: "Payment history and last rent paid, per tenant",
  },
  {
    value: "electricity",
    href: "/dashboard/tenants/electricity",
    label: "Electricity bills",
    description: "K-Electric charges billed to each tenant",
  },
] as const;

export type TenantSectionValue = (typeof tenantSections)[number]["value"];

export function tenantSectionFromPath(pathname: string): TenantSectionValue {
  if (pathname.startsWith("/dashboard/tenants/electricity")) return "electricity";
  if (pathname.startsWith("/dashboard/tenants/records")) return "records";
  return "create";
}
