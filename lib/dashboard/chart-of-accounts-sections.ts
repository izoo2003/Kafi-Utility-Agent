import type { ChartOfAccountsLedger } from "@/lib/types/database";

export const chartOfAccountsSections = [
  {
    value: "solar_panel_clifton" as const satisfies ChartOfAccountsLedger,
    href: "/dashboard/chart-of-accounts",
    label: "Solar Panel Clifton Office",
    description: "Solar panel Clifton Office account ledger",
  },
  {
    value: "eobi" as const satisfies ChartOfAccountsLedger,
    href: "/dashboard/chart-of-accounts/eobi",
    label: "E.O.B.I",
    description: "Employees Old-Age Benefits Institution contribution ledger",
  },
  {
    value: "k_electric_gondpass" as const satisfies ChartOfAccountsLedger,
    href: "/dashboard/chart-of-accounts/k-electric-gondpass",
    label: "K-Electric Gondpass",
    description: "K-Electric Gondpass (A/C # 464886) account ledger",
  },
  {
    value: "kwsb_clifton" as const satisfies ChartOfAccountsLedger,
    href: "/dashboard/chart-of-accounts/kwsb-clifton",
    label: "KWSB Clifton Office",
    description: "K.W & S.B Clifton Office water account ledger",
  },
] as const;

export type ChartOfAccountsSectionValue =
  (typeof chartOfAccountsSections)[number]["value"];

export function chartOfAccountsSectionFromPath(
  pathname: string,
): ChartOfAccountsSectionValue {
  if (pathname.startsWith("/dashboard/chart-of-accounts/eobi")) return "eobi";
  if (pathname.startsWith("/dashboard/chart-of-accounts/k-electric-gondpass")) {
    return "k_electric_gondpass";
  }
  if (pathname.startsWith("/dashboard/chart-of-accounts/kwsb-clifton")) {
    return "kwsb_clifton";
  }
  return "solar_panel_clifton";
}

export function chartOfAccountsSectionMeta(
  ledger: ChartOfAccountsSectionValue,
) {
  return (
    chartOfAccountsSections.find((s) => s.value === ledger) ??
    chartOfAccountsSections[0]
  );
}
