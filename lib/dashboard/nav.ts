export const dashboardNav = [
  {
    href: "/dashboard",
    label: "Home",
    description: "Overview of site operations",
    icon: "home",
    accent: "slate",
  },
  {
    href: "/dashboard/chat",
    label: "Chat",
    description: "Ask or update site records via chat",
    icon: "chat",
    accent: "sky",
  },
  {
    href: "/dashboard/kitchen-inventory",
    label: "Kitchen",
    description: "Stock ledger and consumption analytics",
    icon: "kitchen",
    accent: "emerald",
    children: [
      {
        href: "/dashboard/kitchen-inventory",
        label: "Stock Ledger",
        match: "exact" as const,
      },
      {
        href: "/dashboard/kitchen-inventory/analytics",
        label: "Consumption Analytics",
        match: "prefix" as const,
      },
    ],
  },
  {
    href: "/dashboard/it-equipment",
    label: "IT Equipment",
    description: "Asset register and assignment",
    icon: "it",
    accent: "violet",
  },
  {
    href: "/dashboard/generator",
    label: "Generator",
    description: "Maintenance schedule and fuel log",
    icon: "generator",
    accent: "orange",
  },
  {
    href: "/dashboard/solar",
    label: "Solar",
    description: "Specs, monitoring logs, and SEMS+ live data",
    icon: "solar",
    accent: "teal",
    children: [
      {
        href: "/dashboard/solar",
        label: "Records",
        match: "exact" as const,
      },
      {
        href: "/dashboard/solar/summary",
        label: "Energy Summary",
        match: "prefix" as const,
      },
      {
        href: "/dashboard/solar/consumption",
        label: "Consumption",
        match: "prefix" as const,
      },
      {
        href: "/dashboard/solar/sems",
        label: "SEMS+",
        match: "prefix" as const,
      },
      {
        href: "/dashboard/solar/net-metering",
        label: "Net Metering",
        match: "prefix" as const,
      },
    ],
  },
  {
    href: "/dashboard/utilities",
    label: "Utilities",
    description: "K-Electric (4 sites), SSGC, KWSB, PTCL, Jazz bills & dues",
    icon: "utilities",
    accent: "rose",
  },
  {
    href: "/dashboard/tenants",
    label: "Tenants",
    description: "Accounts, rent records, and tenant electricity bills",
    icon: "tenants",
    accent: "violet",
    children: [
      {
        href: "/dashboard/tenants",
        label: "Create tenant",
        match: "exact" as const,
      },
      {
        href: "/dashboard/tenants/records",
        label: "Rent records",
        match: "prefix" as const,
      },
      {
        href: "/dashboard/tenants/electricity",
        label: "Electricity bills",
        match: "prefix" as const,
      },
    ],
  },
] as const;

export type DashboardNavItem = (typeof dashboardNav)[number];
export type NavAccent =
  | DashboardNavItem["accent"]
  | "amber";
