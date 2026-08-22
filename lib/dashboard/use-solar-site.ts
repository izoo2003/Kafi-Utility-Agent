"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SolarSitePublic } from "@/lib/sems/sites";
import { resolveSolarSiteId } from "@/lib/dashboard/solar-site-nav";

export function useSolarSiteId(
  sites: SolarSitePublic[],
  defaultSiteId: string,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const siteId = useMemo(
    () =>
      resolveSolarSiteId(searchParams.get("site"), sites, defaultSiteId),
    [searchParams, sites, defaultSiteId],
  );

  const site = useMemo(
    () => sites.find((entry) => entry.id === siteId) ?? sites[0] ?? null,
    [sites, siteId],
  );

  const setSiteId = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("site", next);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return { siteId, setSiteId, site, isOffline: site?.offline === true && site?.static !== true, isStatic: site?.static === true };
}
