import type { SemsClient } from "@/lib/sems/client";

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Flatten SEMS+ telecounting/telemetry "factors" groups into { code: data }. */
function flattenFactors(groups: unknown): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  if (!Array.isArray(groups)) return flat;
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const factors = Array.isArray((group as { factors?: unknown }).factors)
      ? ((group as { factors: unknown[] }).factors)
      : [group];
    for (const factor of factors) {
      if (!factor || typeof factor !== "object") continue;
      const code = (factor as { code?: unknown }).code;
      if (typeof code === "string" && code.length > 0) {
        flat[code] = (factor as { data?: unknown }).data;
      }
    }
  }
  return flat;
}

function pickNumber(
  flat: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const n = asNumber(flat[key]);
    if (n !== undefined) return n;
  }
  // Case-insensitive fallback
  const lower = Object.fromEntries(
    Object.entries(flat).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const n = asNumber(lower[key.toLowerCase()]);
    if (n !== undefined) return n;
  }
  return undefined;
}

type DeviceRef = { sn: string; deviceType: string };

function unwrapData(json: unknown): unknown {
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

async function listStationDevices(
  client: SemsClient,
  stationId: string,
): Promise<DeviceRef[]> {
  const json = await client.request(
    "GET",
    "/sems-plant/api/stations/device/all-status",
    { query: { stationId } },
  );
  const data = unwrapData(json) as {
    deviceDetailList?: Array<{
      deviceType?: string;
      statusDetailList?: Array<{
        detailMap?: Record<string, unknown>;
      }>;
    }>;
  } | null;

  const devices: DeviceRef[] = [];
  const lists = data?.deviceDetailList ?? [];
  for (const typeGroup of lists) {
    const deviceType = typeGroup.deviceType || "INVERTER";
    for (const statusDetail of typeGroup.statusDetailList ?? []) {
      const detailMap = statusDetail.detailMap ?? {};
      for (const sn of Object.keys(detailMap)) {
        if (sn) devices.push({ sn, deviceType });
      }
    }
  }
  return devices;
}

const GEN_TODAY_KEYS = [
  "proPvStatsToday",
  "eDay",
  "eday",
  "eGen",
  "ePvToday",
  "generationEnergy",
  "pvToday",
  "todayGeneration",
];

const USE_TODAY_KEYS = [
  "proLoadStatsToday",
  "eLoadToday",
  "eUse",
  "eConsumToday",
  "consumptionEnergy",
  "loadToday",
  "todayConsumption",
];

export type DayEnergy = {
  generationTodayKwh?: number;
  consumptionTodayKwh?: number;
};

/**
 * Daily energy is usually NOT on stations/flow — it lives on equipment
 * telecounting (proPvStatsToday / load today). Sum across station devices.
 */
export async function fetchDayEnergy(
  client: SemsClient,
  stationId: string,
): Promise<DayEnergy> {
  let devices: DeviceRef[] = [];
  try {
    devices = await listStationDevices(client, stationId);
  } catch {
    return {};
  }
  if (devices.length === 0) return {};

  let generation = 0;
  let consumption = 0;
  let sawGen = false;
  let sawUse = false;

  for (const device of devices) {
    try {
      const telecountingJson = await client.request(
        "GET",
        `/sems-plant/api/equipments/${encodeURIComponent(device.sn)}/telecounting`,
        {
          query: {
            deviceType: device.deviceType,
            pwId: stationId,
          },
        },
      );
      const flat = flattenFactors(unwrapData(telecountingJson));
      const gen = pickNumber(flat, GEN_TODAY_KEYS);
      const use = pickNumber(flat, USE_TODAY_KEYS);
      if (gen !== undefined) {
        generation += gen;
        sawGen = true;
      }
      if (use !== undefined) {
        consumption += use;
        sawUse = true;
      }
    } catch {
      // Skip devices that don't expose telecounting
    }
  }

  return {
    generationTodayKwh: sawGen ? generation : undefined,
    consumptionTodayKwh: sawUse ? consumption : undefined,
  };
}
