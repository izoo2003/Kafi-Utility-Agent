/**
 * Probe SEMS+ for day energy split (to load / to grid) factor codes.
 * Run: npx tsx scripts/probe-sems-energy.ts
 */
import { config } from "dotenv";
config();
import { SemsClient } from "../lib/sems/client";
import { getSemsConfig } from "../lib/sems/config";

function unwrap(json: unknown) {
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

function flattenFactors(groups: unknown): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  if (!Array.isArray(groups)) return flat;
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const factors = Array.isArray((group as { factors?: unknown }).factors)
      ? (group as { factors: unknown[] }).factors
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

async function main() {
  const cfg = getSemsConfig();
  if (!cfg) throw new Error("SEMS not configured");
  const client = new SemsClient(cfg.region, cfg.email, cfg.password);

  const devicesJson = await client.request(
    "GET",
    "/sems-plant/api/stations/device/all-status",
    { query: { stationId: cfg.stationId } },
  );
  const deviceData = unwrap(devicesJson) as {
    deviceDetailList?: Array<{
      deviceType?: string;
      statusDetailList?: Array<{ detailMap?: Record<string, unknown> }>;
    }>;
  };
  const devices: { sn: string; deviceType: string }[] = [];
  for (const g of deviceData?.deviceDetailList ?? []) {
    for (const s of g.statusDetailList ?? []) {
      for (const sn of Object.keys(s.detailMap ?? {})) {
        devices.push({ sn, deviceType: g.deviceType || "INVERTER" });
      }
    }
  }
  console.log("devices", devices);

  for (const d of devices.slice(0, 3)) {
    const tele = await client.request(
      "GET",
      `/sems-plant/api/equipments/${encodeURIComponent(d.sn)}/telecounting`,
      { query: { deviceType: d.deviceType, pwId: cfg.stationId } },
    );
    const flat = flattenFactors(unwrap(tele));
    console.log("\ntelecounting", d.sn, Object.keys(flat).sort().join(", "));
    for (const [k, v] of Object.entries(flat)) {
      const kl = k.toLowerCase();
      if (
        /sell|buy|grid|load|self|feed|export|import|pv|gen|use|consum|today|day|bat/i.test(
          kl,
        )
      ) {
        console.log(" ", k, "=", v);
      }
    }
  }

  const candidates: Array<{ method: "GET" | "POST"; path: string; query?: Record<string, string>; body?: unknown }> = [
    {
      method: "GET",
      path: "/sems-plant/api/stations/energy",
      query: { stationId: cfg.stationId },
    },
    {
      method: "GET",
      path: "/sems-plant/api/stations/consumption",
      query: { stationId: cfg.stationId },
    },
    {
      method: "POST",
      path: "/sems-plant/api/v1/hems/energy/statistics",
      body: { stationId: cfg.stationId, timeScale: 1 },
    },
    {
      method: "POST",
      path: "/sems-plant/api/stations/statistics",
      body: { id: cfg.stationId, date: new Date().toISOString().slice(0, 10), type: 1 },
    },
  ];

  for (const c of candidates) {
    try {
      const json = await client.request(c.method, c.path, {
        query: c.query,
        body: c.body,
      });
      const data = unwrap(json);
      console.log("\nOK", c.method, c.path);
      console.log(JSON.stringify(data, null, 2).slice(0, 1200));
    } catch (e) {
      console.log("\nFAIL", c.method, c.path, e instanceof Error ? e.message.slice(0, 160) : e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
