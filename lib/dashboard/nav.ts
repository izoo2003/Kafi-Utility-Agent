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
    href: "/dashboard/appliances",
    label: "Appliances",
    description: "Clifton Office and GondPass Mill registers",
    icon: "appliances",
    accent: "amber",
    children: [
      {
        href: "/dashboard/appliances",
        label: "Clifton Office",
        match: "exact" as const,
      },
      {
        href: "/dashboard/appliances/gondpass-mill",
        label: "GondPass Mill",
        match: "prefix" as const,
      },
    ],
  },
  {
    href: "/dashboard/generator",
    label: "Generator",
    description: "Maintenance, outage runs, expenses, fuel, and vendors",
    icon: "generator",
    accent: "orange",
    children: [
      {
        href: "/dashboard/generator",
        label: "Maintenance",
        match: "exact" as const,
      },
      {
        href: "/dashboard/generator/runs",
        label: "Outage/Generator Runs",
        match: "prefix" as const,
      },
      {
        href: "/dashboard/generator/expenses",
        label: "Expenses",
        match: "prefix" as const,
      },
      {
        href: "/dashboard/generator/fuel",
        label: "Fuel",
        match: "prefix" as const,
      },
      {
        href: "/dashboard/generator/vendors",
        label: "Vendor",
        match: "prefix" as const,
      },
    ],
  },
  {
    href: "/dashboard/solar",
    label: "Solar",
    description: "Specs, monitoring, service logs, and SEMS+ live data",
    icon: "solar",
    accent: "teal",
    children: [
      {
        href: "/dashboard/solar",
        label: "Records",
        match: "exact" as const,
      },
      {
        href: "/dashboard/solar/service",
        label: "Service logs",
        match: "prefix" as const,
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
    description: "Tenant accounts, rent ledger, and electricity bills",
    icon: "tenants",
    accent: "violet",
    children: [
      {
        href: "/dashboard/tenants",
        label: "Tenants",
        match: "exact" as const,
      },
      {
        href: "/dashboard/tenants/withholding-tax",
        label: "Withholding Tax Slabs",
        match: "prefix" as const,
      },
    ],
  },
  {
    href: "/dashboard/chart-of-accounts",
    label: "Chart of Accounts",
    description:
      "Solar Panel Clifton, E.O.B.I, K-Electric Gondpass, KWSB Clifton ledgers",
    icon: "accounts",
    accent: "amber",
    children: [
      {
        href: "/dashboard/chart-of-accounts",
        label: "Solar Panel Clifton Office",
        match: "exact" as const,
      },
      {
        href: "/dashboard/chart-of-accounts/eobi",
        label: "E.O.B.I",
        match: "prefix" as const,
      },
      {
        href: "/dashboard/chart-of-accounts/k-electric-gondpass",
        label: "K-Electric Gondpass",
        match: "prefix" as const,
      },
      {
        href: "/dashboard/chart-of-accounts/kwsb-clifton",
        label: "KWSB Clifton Office",
        match: "prefix" as const,
      },
    ],
  },
] as const;

export type DashboardNavItem = (typeof dashboardNav)[number];
export type NavAccent =
  | DashboardNavItem["accent"]
  | "amber";
