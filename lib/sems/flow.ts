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

function flatten(
  obj: unknown,
  out: Record<string, unknown>,
  prefix = "",
): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) return;
  for (const [fieldName, fieldValue] of Object.entries(
    obj as Record<string, unknown>,
  )) {
    const dottedKey = prefix ? `${prefix}.${fieldName}` : fieldName;
    if (
      fieldValue &&
      typeof fieldValue === "object" &&
      !Array.isArray(fieldValue)
    ) {
      flatten(fieldValue, out, dottedKey);
    } else {
      out[dottedKey] = fieldValue;
      out[fieldName] = fieldValue;
    }
  }
}

export function parseFlowPayload(json: unknown): LiveFlow {
  const data = (json as { data?: unknown }).data ?? json;
  const flat: Record<string, unknown> = {};
  flatten(data, flat);

  const pick = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const parsed = asNumber(flat[key]);
      if (parsed !== undefined) return parsed;
    }
    return undefined;
  };

  return {
    pSystem: pick(
      "pSystem",
      "ppv",
      "pPv",
      "pv",
      "generation",
      "pGeneration",
      "solarPower",
    ),
    pConsum: pick(
      "pConsum",
      "pload",
      "pLoad",
      "load",
      "consumption",
      "pConsumption",
    ),
    pGrid: pick("pGrid", "grid", "pMeter"),
    pBat: pick("pBat", "battery", "pBattery"),
    soc: pick("soc", "batterySoc", "batSoc"),
    eGen: pick(
      "eGen",
      "eday",
      "eDay",
      "generationEnergy",
      "ePvToday",
      "proPvStatsToday",
      "todayGeneration",
      "pvToday",
      "e_day",
    ),
    eUse: pick(
      "eUse",
      "eLoadToday",
      "consumptionEnergy",
      "eConsumToday",
      "proLoadStatsToday",
      "todayConsumption",
      "loadToday",
    ),
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
