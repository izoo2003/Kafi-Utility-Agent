import type { SolarSitePublic } from "@/lib/sems/sites";

export function solarSiteNavLabel(label: string) {
  return /\bsolar\b/i.test(label) ? label : `${label} Solar`;
}

export function resolveSolarSiteId(
  siteParam: string | undefined | null,
  sites: SolarSitePublic[],
  fallback?: string,
): string {
  const key = siteParam?.trim();
  if (key && sites.some((site) => site.id === key)) return key;
  if (fallback && sites.some((site) => site.id === fallback)) return fallback;
  return sites[0]?.id ?? "";
}

export function hrefWithSolarSite(href: string, siteId?: string | null) {
  if (!siteId?.trim()) return href;
  const url = new URL(href, "http://local");
  url.searchParams.set("site", siteId.trim());
  return `${url.pathname}${url.search}`;
}
