import { z } from "zod";
import { resolveRegion, type RegionConfig } from "@/lib/sems/regions";
import { parseStationDetailBlob } from "@/lib/sems/types";

const siteInputSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  server: z.string().trim().optional(),
  email: z.string().trim().min(1),
  password: z.string().min(1),
  stationId: z.string().trim().optional(),
  stationDetail: z.string().trim().optional(),
  stationName: z.string().trim().optional().nullable(),
  timeZone: z.string().trim().optional(),
});

export type SolarSiteConfig = {
  id: string;
  label: string;
  region: RegionConfig;
  email: string;
  password: string;
  stationId: string;
  stationName: string | null;
  timeZone: string;
};

export type SolarSitePublic = {
  id: string;
  label: string;
  stationId: string;
  stationName: string | null;
};

function resolveSite(raw: z.infer<typeof siteInputSchema>): SolarSiteConfig {
  const region = resolveRegion(
    raw.server?.trim() || process.env.SEMS_SERVER?.trim() || "eu",
  );
  let stationId = raw.stationId?.trim() ?? "";
  let stationName = raw.stationName?.trim() ?? null;

  if (raw.stationDetail) {
    const detail = parseStationDetailBlob(raw.stationDetail);
    stationId = stationId || detail.stationId;
    stationName = stationName ?? detail.stationName ?? null;
  }

  if (!stationId) {
    throw new Error(
      `Solar site "${raw.id}" is missing stationId (or stationDetail)`,
    );
  }

  return {
    id: raw.id,
    label: raw.label,
    region,
    email: raw.email,
    password: raw.password,
    stationId,
    stationName,
    timeZone:
      raw.timeZone?.trim() ||
      process.env.SEMS_TIMEZONE?.trim() ||
      region.defaultTimezone,
  };
}

function legacySiteFromEnv(): SolarSiteConfig | null {
  const email = process.env.SEMS_EMAIL?.trim();
  const password = process.env.SEMS_PASSWORD?.trim();
  if (!email || !password) return null;

  const stationIdEnv = process.env.SEMS_STATION_ID?.trim();
  const stationDetailEnv = process.env.SEMS_STATION_DETAIL?.trim();
  let stationId = stationIdEnv ?? "";
  let stationName: string | null = null;

  if (stationDetailEnv) {
    const detail = parseStationDetailBlob(stationDetailEnv);
    stationId = stationId || detail.stationId;
    stationName = detail.stationName ?? null;
  }

  if (!stationId) {
    throw new Error(
      "SEMS credentials are set but SEMS_STATION_ID (or SEMS_STATION_DETAIL) is missing",
    );
  }

  return resolveSite({
    id: "kafi-commodities",
    label: "Kafi Commodities",
    email,
    password,
    stationId,
    stationName,
  });
}

export function listSolarSites(): SolarSiteConfig[] {
  const json = process.env.SEMS_SITES?.trim();
  if (json) {
    const parsed = JSON.parse(json) as unknown;
    const arr = z.array(siteInputSchema).parse(parsed);
    return arr.map(resolveSite);
  }

  const legacy = legacySiteFromEnv();
  return legacy ? [legacy] : [];
}

export function getSolarSite(id?: string | null): SolarSiteConfig | null {
  const sites = listSolarSites();
  if (!sites.length) return null;
  if (!id?.trim()) return sites[0]!;

  const key = id.trim().toLowerCase();
  return (
    sites.find(
      (site) =>
        site.id.toLowerCase() === key ||
        site.stationId.toLowerCase() === key ||
        site.stationName?.toLowerCase() === key,
    ) ?? null
  );
}

export function requireSolarSite(id?: string | null): SolarSiteConfig {
  const site = getSolarSite(id);
  if (!site) {
    if (id?.trim()) {
      throw new Error(`Unknown solar site "${id.trim()}"`);
    }
    throw new Error("No solar sites configured");
  }
  return site;
}

export function listSolarSitesPublic(): SolarSitePublic[] {
  return listSolarSites().map(({ id, label, stationId, stationName }) => ({
    id,
    label,
    stationId,
    stationName,
  }));
}

/** True when at least one SEMS site is configured. */
export function isSemsConfigured(): boolean {
  return listSolarSites().length > 0;
}
