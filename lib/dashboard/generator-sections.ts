export const generatorSections = [
  {
    value: "maintenance" as const,
    href: "/dashboard/generator",
    label: "Maintenance",
    description: "Monthly checkups and oil changes",
    pageDescription:
      "Log monthly checkups and oil changes. Oil change every 200 generator hours from logged outage runs. Dates: DD/MM/YYYY.",
  },
  {
    value: "runs" as const,
    href: "/dashboard/generator/runs",
    label: "Outage/Generator Runs",
    description: "Manual outage run log (not live)",
    pageDescription:
      "When power fails and the generator runs, log that session. Those hours add up toward the 200 h oil change. Dates: DD/MM/YYYY.",
  },
  {
    value: "expenses" as const,
    href: "/dashboard/generator/expenses",
    label: "Expenses",
    description: "Expense ledger (total = sum of debit)",
    pageDescription:
      "Generator expense ledger. Total expense is the sum of debit. Dates: DD/MM/YYYY.",
  },
  {
    value: "fuel" as const,
    href: "/dashboard/generator/fuel",
    label: "Fuel",
    description: "Fuel fills, hours, and tank level",
    pageDescription:
      "Fuel log: litres added, running hours, tank level, and cost. Dates: DD/MM/YYYY.",
  },
  {
    value: "vendors" as const,
    href: "/dashboard/generator/vendors",
    label: "Vendor",
    description: "People responsible for generator maintenance",
    pageDescription:
      "Vendors who service the generator. Add, edit, or remove contacts (name and phone).",
  },
] as const;

export type GeneratorSectionValue = (typeof generatorSections)[number]["value"];

export function generatorSectionFromPath(
  pathname: string,
): GeneratorSectionValue {
  if (pathname.startsWith("/dashboard/generator/runs")) return "runs";
  if (pathname.startsWith("/dashboard/generator/expenses")) return "expenses";
  if (pathname.startsWith("/dashboard/generator/fuel")) return "fuel";
  if (pathname.startsWith("/dashboard/generator/vendors")) return "vendors";
  return "maintenance";
}

export function generatorSectionMeta(section: GeneratorSectionValue) {
  return (
    generatorSections.find((s) => s.value === section) ?? generatorSections[0]
  );
}
