import type { SemsClient } from "@/lib/sems/client";

export type LiveFlow = {
  pSystem?: number;
  pConsum?: number;
  pGrid?: number;
  pBat?: number;
  soc?: number;
  eGen?: number;
  eUse?: number;
  raw: Record<string, unknown>;
};

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * SEMS+ `flows` is a topology map (arrays of related node names), not power.
 * Drop it before flattening so those arrays can never clobber pSystem/pGrid.
 */
function withoutTopology(data: unknown): unknown {
  if (!isPlainObject(data)) return data;
  const { flows: _flows, ...rest } = data;
  return rest;
}

function flatten(
  obj: unknown,
  out: Record<string, unknown>,
  prefix = "",
): void {
  if (!isPlainObject(obj)) return;
  for (const [fieldName, fieldValue] of Object.entries(obj)) {
    const dottedKey = prefix ? `${prefix}.${fieldName}` : fieldName;
    if (isPlainObject(fieldValue)) {
      flatten(fieldValue, out, dottedKey);
      continue;
    }
    // Keep arrays/objects only under dotted keys; short keys are primitives.
    out[dottedKey] = fieldValue;
    if (
      fieldValue == null ||
      typeof fieldValue === "number" ||
      typeof fieldValue === "string" ||
      typeof fieldValue === "boolean"
    ) {
      const existing = out[fieldName];
      if (existing === undefined || asNumber(existing) === undefined) {
        out[fieldName] = fieldValue;
      } else if (
        asNumber(existing) === undefined &&
        asNumber(fieldValue) !== undefined
      ) {
        out[fieldName] = fieldValue;
      } else if (
        typeof existing !== "number" &&
        typeof fieldValue === "number"
      ) {
        out[fieldName] = fieldValue;
      }
    }
  }
}

function pickNumber(
  flat: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const parsed = asNumber(flat[key]);
    if (parsed !== undefined) return parsed;
  }
  const lower = Object.fromEntries(
    Object.entries(flat).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const parsed = asNumber(lower[key.toLowerCase()]);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

const PV_KEYS = [
  "pSystem",
  "ppv",
  "pPv",
  "pv",
  "generation",
  "pGeneration",
  "solarPower",
  "pDc",
];
const LOAD_KEYS = [
  "pConsum",
  "pload",
  "pLoad",
  "load",
  "consumption",
  "pConsumption",
  "pBackup",
];
const GRID_KEYS = ["pGrid", "grid", "pMeter"];
const BAT_KEYS = ["pBat", "battery", "pBattery"];
const SOC_KEYS = ["soc", "batterySoc", "batSoc"];
const EGEN_KEYS = [
  "eGen",
  "eday",
  "eDay",
  "generationEnergy",
  "ePvToday",
  "proPvStatsToday",
  "todayGeneration",
  "pvToday",
  "e_day",
];
const EUSE_KEYS = [
  "eUse",
  "eLoadToday",
  "consumptionEnergy",
  "eConsumToday",
  "proLoadStatsToday",
  "todayConsumption",
  "loadToday",
];

/** Parse SEMS+ GET /sems-plant/api/stations/flow response body. */
export function parseFlowPayload(json: unknown): LiveFlow {
  const data = (json as { data?: unknown }).data ?? json;
  const root = isPlainObject(data) ? data : {};
  // Prefer direct root metrics first (authoritative for this endpoint).
  const fromRoot = {
    pSystem: pickNumber(root, PV_KEYS),
    pConsum: pickNumber(root, LOAD_KEYS),
    pGrid: pickNumber(root, GRID_KEYS),
    pBat: pickNumber(root, BAT_KEYS),
    soc: pickNumber(root, SOC_KEYS),
    eGen: pickNumber(root, EGEN_KEYS),
    eUse: pickNumber(root, EUSE_KEYS),
  };

  const flat: Record<string, unknown> = {};
  flatten(withoutTopology(data), flat);

  return {
    pSystem: fromRoot.pSystem ?? pickNumber(flat, PV_KEYS),
    pConsum: fromRoot.pConsum ?? pickNumber(flat, LOAD_KEYS),
    pGrid: fromRoot.pGrid ?? pickNumber(flat, GRID_KEYS),
    pBat: fromRoot.pBat ?? pickNumber(flat, BAT_KEYS),
    soc: fromRoot.soc ?? pickNumber(flat, SOC_KEYS),
    eGen: fromRoot.eGen ?? pickNumber(flat, EGEN_KEYS),
    eUse: fromRoot.eUse ?? pickNumber(flat, EUSE_KEYS),
    raw: flat,
  };
}

export async function fetchLiveFlow(
  client: SemsClient,
  stationId: string,
): Promise<LiveFlow> {
  const json = await client.request("GET", "/sems-plant/api/stations/flow", {
    query: { stationId },
  });
  return parseFlowPayload(json);
}
