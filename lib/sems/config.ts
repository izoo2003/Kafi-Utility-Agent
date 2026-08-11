import { resolveRegion, type RegionConfig } from "@/lib/sems/regions";
import { parseStationDetailBlob } from "@/lib/sems/types";

export type SemsConfig = {
  region: RegionConfig;
  email: string;
  password: string;
  stationId: string;
  stationName: string | null;
  timeZone: string;
};

export function getSemsConfig(): SemsConfig | null {
  const email = process.env.SEMS_EMAIL?.trim();
  const password = process.env.SEMS_PASSWORD?.trim();
  if (!email || !password) return null;

  const region = resolveRegion(process.env.SEMS_SERVER?.trim() || "eu");
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

  return {
    region,
    email,
    password,
    stationId,
    stationName,
    timeZone:
      process.env.SEMS_TIMEZONE?.trim() || region.defaultTimezone,
  };
}

/** True when login credentials are present (station id validated at sync time). */
export function isSemsConfigured(): boolean {
  return Boolean(
    process.env.SEMS_EMAIL?.trim() && process.env.SEMS_PASSWORD?.trim(),
  );
}
