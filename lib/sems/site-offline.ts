import type { SolarSiteConfig, SolarSitePublic } from "@/lib/sems/sites";

export const SOLAR_SITE_OFFLINE_MESSAGE =
  "This solar plant is offline. Kindly contact the administrator to turn it on.";

export function isSolarSiteOffline(
  site:
    | Pick<SolarSitePublic, "offline" | "static">
    | Pick<SolarSiteConfig, "offline" | "static">,
): boolean {
  return site.offline === true && site.static !== true;
}

export function solarSiteOfflinePayload(siteLabel?: string | null) {
  return {
    error: SOLAR_SITE_OFFLINE_MESSAGE,
    offline: true as const,
    site_label: siteLabel ?? null,
  };
}
