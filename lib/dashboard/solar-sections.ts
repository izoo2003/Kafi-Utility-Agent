export const solarSections = [
  {
    value: "records",
    href: "/dashboard/solar",
    label: "Records",
    description: "System specs and monitoring logs",
  },
  {
    value: "service",
    href: "/dashboard/solar/service",
    label: "Service logs",
    description: "Service logs and maintenance for each solar plant",
  },
  {
    value: "summary",
    href: "/dashboard/solar/summary",
    label: "Energy Summary",
    description: "Monthly generated, consumed, and grid export",
  },
  {
    value: "consumption",
    href: "/dashboard/solar/consumption",
    label: "Consumption",
    description: "To Load / To Grid by day, week, month, year",
  },
  {
    value: "sems",
    href: "/dashboard/solar/sems",
    label: "SEMS+",
    description: "Live GoodWe plant telemetry",
  },
  {
    value: "net-metering",
    href: "/dashboard/solar/net-metering",
    label: "Net Metering",
    description: "Per-plant KE ledger, credit balance, refund estimate",
  },
] as const;

export type SolarSectionValue = (typeof solarSections)[number]["value"];

export function solarSectionFromPath(pathname: string): SolarSectionValue {
  if (pathname.startsWith("/dashboard/solar/net-metering")) return "net-metering";
  if (pathname.startsWith("/dashboard/solar/sems")) return "sems";
  if (pathname.startsWith("/dashboard/solar/consumption")) return "consumption";
  if (pathname.startsWith("/dashboard/solar/summary")) return "summary";
  if (pathname.startsWith("/dashboard/solar/service")) return "service";
  return "records";
}
