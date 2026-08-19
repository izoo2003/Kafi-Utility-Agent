export const solarSections = [
  {
    value: "records",
    href: "/dashboard/solar",
    label: "Records",
    description: "System specs and monitoring logs",
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
] as const;

export type SolarSectionValue = (typeof solarSections)[number]["value"];

export function solarSectionFromPath(pathname: string): SolarSectionValue {
  if (pathname.startsWith("/dashboard/solar/sems")) return "sems";
  if (pathname.startsWith("/dashboard/solar/consumption")) return "consumption";
  if (pathname.startsWith("/dashboard/solar/summary")) return "summary";
  return "records";
}
