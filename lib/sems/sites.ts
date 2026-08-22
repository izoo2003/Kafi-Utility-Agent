import { z } from "zod";
import { resolveRegion, type RegionConfig } from "@/lib/sems/regions";
import { parseStationDetailBlob } from "@/lib/sems/types";
import { BUILTIN_STATIC_SOLAR_SITES } from "@/lib/solar/static-sites/registry";

const siteInputSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    server: z.string().trim().optional(),
    email: z.string().trim().optional(),
    password: z.string().optional(),
    stationId: z.string().trim().optional(),
    stationDetail: z.string().trim().optional(),
    stationName: z.string().trim().optional().nullable(),
    timeZone: z.string().trim().optional(),
    offline: z.boolean().optional(),
    static: z.boolean().optional(),
  })
  .superRefine((raw, ctx) => {
    const isStatic = raw.static === true;
    if (!isStatic) {
      if (!raw.email?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Solar site "${raw.id}" requires email unless static=true`,
          path: ["email"],
        });
      }
      if (!raw.password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Solar site "${raw.id}" requires password unless static=true`,
          path: ["password"],
        });
      }
    }
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
  offline: boolean;
  static: boolean;
};

export type SolarSitePublic = {
  id: string;
  label: string;
  stationId: string;
  stationName: string | null;
  offline: boolean;
  static: boolean;
};

type SolarSitesLoadResult = {
  sites: SolarSiteConfig[];
  configError: string | null;
};

let loadCache: SolarSitesLoadResult | null = null;

function formatLoadError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join("; ");
  }
  if (error instanceof Error) return error.message;
  return "Invalid SEMS_SITES configuration";
}

function resolveSite(raw: z.infer<typeof siteInputSchema>): SolarSiteConfig {
  const isStatic = raw.static === true;
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
    email: raw.email?.trim() || "static@local",
    password: raw.password || "static",
    stationId,
    stationName,
    timeZone:
      raw.timeZone?.trim() ||
      process.env.SEMS_TIMEZONE?.trim() ||
      region.defaultTimezone,
    offline: raw.offline === true,
    static: isStatic,
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
    return null;
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

function loadBuiltinStaticSites(
  excludeIds: Set<string>,
): SolarSiteConfig[] {
  return BUILTIN_STATIC_SOLAR_SITES.filter(
    (site) => !excludeIds.has(site.id.toLowerCase()),
  ).map((site) =>
    resolveSite({
      id: site.id,
      label: site.label,
      static: site.static,
      stationId: site.stationId,
      stationName: site.stationName,
      timeZone: site.timeZone,
    }),
  );
}

function loadSolarSitesFromEnv(): {
  fromEnv: SolarSiteConfig[];
  configError: string | null;
} {
  const json = process.env.SEMS_SITES?.trim();
  if (!json) {
    const legacy = legacySiteFromEnv();
    return { fromEnv: legacy ? [legacy] : [], configError: null };
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    const arr = z.array(siteInputSchema).parse(parsed);
    return { fromEnv: arr.map(resolveSite), configError: null };
  } catch (error) {
    const detail = formatLoadError(error);
    console.error("[solar] SEMS_SITES failed to load:", detail);
    const legacy = legacySiteFromEnv();
    return {
      fromEnv: legacy ? [legacy] : [],
      configError: `SEMS_SITES is invalid (${detail}). Built-in static sites still load; fix the env var on Vercel.`,
    };
  }
}

function loadSolarSitesCached(): SolarSitesLoadResult {
  if (loadCache) return loadCache;

  const { fromEnv, configError } = loadSolarSitesFromEnv();
  const envIds = new Set(fromEnv.map((site) => site.id.toLowerCase()));
  const builtins = loadBuiltinStaticSites(envIds);

  loadCache = {
    sites: [...fromEnv, ...builtins],
    configError,
  };
  return loadCache;
}

/** Non-fatal SEMS_SITES parse/validation error (page can still render built-in sites). */
export function getSolarSitesConfigError(): string | null {
  return loadSolarSitesCached().configError;
}

export function listSolarSites(): SolarSiteConfig[] {
  return loadSolarSitesCached().sites;
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
  return listSolarSites().map(
    ({ id, label, stationId, stationName, offline, static: isStatic }) => ({
      id,
      label,
      stationId,
      stationName,
      offline,
      static: isStatic,
    }),
  );
}

/** True when at least one SEMS site is configured. */
export function isSemsConfigured(): boolean {
  return listSolarSites().length > 0;
}
