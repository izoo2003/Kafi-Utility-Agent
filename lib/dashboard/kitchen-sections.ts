export const kitchenSections = [
  {
    value: "ledger",
    href: "/dashboard/kitchen-inventory",
    label: "Stock Ledger",
    description: "In / Out records and current stock (In − Out)",
  },
  {
    value: "analytics",
    href: "/dashboard/kitchen-inventory/analytics",
    label: "Consumption Analytics",
    description: "Monthly Out trends, charts, alerts, and AI insights",
  },
] as const;

export type KitchenSectionValue = (typeof kitchenSections)[number]["value"];

export function kitchenSectionFromPath(pathname: string): KitchenSectionValue {
  if (pathname.startsWith("/dashboard/kitchen-inventory/analytics")) {
    return "analytics";
  }
  return "ledger";
}
