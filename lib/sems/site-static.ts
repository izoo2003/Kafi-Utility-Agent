import type { SolarSiteConfig, SolarSitePublic } from "@/lib/sems/sites";

export const SOLAR_SITE_STATIC_MESSAGE =
  "Static archive — values captured from on-site readings, not live SEMS+.";

export function isSolarSiteStatic(
  site:
    | Pick<SolarSitePublic, "static">
    | Pick<SolarSiteConfig, "static">
    | null
    | undefined,
): boolean {
  return site?.static === true;
}

export function solarSiteStaticPayload(siteLabel?: string | null) {
  return {
    static: true as const,
    site_label: siteLabel ?? null,
    note: SOLAR_SITE_STATIC_MESSAGE,
  };
}
