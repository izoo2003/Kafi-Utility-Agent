import type { ApplianceSite } from "@/lib/types/database";

export const applianceSites = [
  {
    value: "clifton_office" as const satisfies ApplianceSite,
    href: "/dashboard/appliances",
    label: "Clifton Office",
    description: "Appliances at Clifton Office",
    exportResource: "appliances-clifton-office" as const,
    importTarget: "appliances-clifton-office" as const,
  },
  {
    value: "gondpass_mill" as const satisfies ApplianceSite,
    href: "/dashboard/appliances/gondpass-mill",
    label: "GondPass Mill",
    description: "Appliances at GondPass Mill",
    exportResource: "appliances-gondpass-mill" as const,
    importTarget: "appliances-gondpass-mill" as const,
  },
] as const;

export type ApplianceSiteValue = (typeof applianceSites)[number]["value"];

export function applianceSiteFromPath(pathname: string): ApplianceSiteValue {
  if (pathname.startsWith("/dashboard/appliances/gondpass-mill")) {
    return "gondpass_mill";
  }
  return "clifton_office";
}

export function applianceSiteMeta(site: ApplianceSite) {
  return (
    applianceSites.find((s) => s.value === site) ?? applianceSites[0]
  );
}

export function applianceSiteHref(site: ApplianceSite) {
  return applianceSiteMeta(site).href;
}
