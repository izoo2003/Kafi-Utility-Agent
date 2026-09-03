import {
  SUNGROW_OFFICE_SITE_ID,
  SUNGROW_OFFICE_STATION_ID,
} from "@/lib/solar/static-sites/sungrow-office";

/** Static solar sites shipped with the app (no SEMS credentials required). */
export const BUILTIN_STATIC_SOLAR_SITES = [
  {
    id: SUNGROW_OFFICE_SITE_ID,
    label: "Sungrow Office",
    static: true as const,
    stationId: SUNGROW_OFFICE_STATION_ID,
    stationName: "SunGrow Office SG33CX",
    timeZone: "Asia/Karachi",
  },
] as const;

export type BuiltinStaticSolarSite = (typeof BUILTIN_STATIC_SOLAR_SITES)[number];
