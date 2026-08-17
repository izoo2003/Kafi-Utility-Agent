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
    accent: "slate",
  },
  {
    href: "/dashboard/kitchen-inventory",
    label: "Kitchen",
    description: "Stock levels and reorder thresholds",
    icon: "kitchen",
    accent: "amber",
  },
  {
    href: "/dashboard/it-equipment",
    label: "IT Equipment",
    description: "Asset register and assignment",
    icon: "it",
    accent: "sky",
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
        href: "/dashboard/solar/sems",
        label: "SEMS+",
        match: "prefix" as const,
      },
    ],
  },
  {
    href: "/dashboard/utilities",
    label: "Utilities",
    description: "K-Electric (4 sites), PTCL, SSGC, KWSB, Jazz bills & dues",
    icon: "utilities",
    accent: "emerald",
  },
] as const;

export type DashboardNavItem = (typeof dashboardNav)[number];
export type NavAccent = DashboardNavItem["accent"];
