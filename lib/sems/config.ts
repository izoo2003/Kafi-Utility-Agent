import {
  getSolarSite,
  isSemsConfigured as sitesConfigured,
  listSolarSites,
  type SolarSiteConfig,
} from "@/lib/sems/sites";

export type SemsConfig = SolarSiteConfig;

export { listSolarSites, listSolarSitesPublic, requireSolarSite, getSolarSite } from "@/lib/sems/sites";
export type { SolarSiteConfig, SolarSitePublic } from "@/lib/sems/sites";

/** Resolve one configured SEMS site (defaults to the first). */
export function getSemsConfig(siteId?: string | null): SemsConfig | null {
  return getSolarSite(siteId);
}

/** True when login credentials are present for at least one site. */
export function isSemsConfigured(): boolean {
  return sitesConfigured();
}
