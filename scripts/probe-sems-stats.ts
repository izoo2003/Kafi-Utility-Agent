/**
 * Probe SEMS+ statisticsAndPreV2 for to-load / to-grid via power integration.
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

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

async function main() {
  const cfg = getSemsConfig();
  if (!cfg) throw new Error("SEMS not configured");
  const client = new SemsClient(cfg.region, cfg.email, cfg.password);

  const now = new Date();
  // Local Asia/Karachi day window approx as ISO with offset +05:00
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const startTime = `${y}-${m}-${d} 00:00:00`;
  const endTime = `${y}-${m}-${d} 23:59:59`;

  const json = await client.request(
    "POST",
    "/sems-plant/api/v1/hems/power/statisticsAndPreV2",
    {
      body: {
        stationId: cfg.stationId,
        items: ["pSystem", "soc", "pBat", "pConsum", "pGrid"],
        timeScale: 1,
        timeZone: "Asia/Karachi",
        startTime,
        endTime,
      },
    },
  );
  const data = unwrap(json) as Record<string, unknown>;
  console.log("keys", Object.keys(data ?? {}));
  const dataList = (data as { dataList?: unknown }).dataList;
  console.log("dataList length", Array.isArray(dataList) ? dataList.length : null);

  if (Array.isArray(dataList)) {
    for (const entry of dataList) {
      const e = entry as { item?: string; powerData?: unknown[] };
      console.log("item", e.item, "samples", e.powerData?.length);
      if (e.powerData?.[0]) console.log(" sample0", e.powerData[0]);
      if (e.powerData && e.powerData.length > 10) {
        console.log(" sample mid", e.powerData[Math.floor(e.powerData.length / 2)]);
      }
    }
  }

  // Integrate energy assuming ~1 minute samples in kW → kWh
  const byItem = new Map<string, number>();
  if (Array.isArray(dataList)) {
    for (const entry of dataList) {
      const e = entry as { item?: string; powerData?: Array<Record<string, unknown>> };
      if (!e.item || !Array.isArray(e.powerData) || e.powerData.length < 2) continue;
      let energy = 0;
      let exportE = 0;
      let importE = 0;
      for (let i = 1; i < e.powerData.length; i++) {
        const prev = e.powerData[i - 1]!;
        const cur = e.powerData[i]!;
        const p = asNumber(cur.power ?? cur.value) ?? 0;
        const t0 = String(prev.tp ?? "");
        const t1 = String(cur.tp ?? "");
        // parse "YYYY-MM-DD HH:mm:ss"
        const ms =
          Date.parse(t1.replace(" ", "T") + "+05:00") -
          Date.parse(t0.replace(" ", "T") + "+05:00");
        const hours = ms > 0 && ms < 3600_000 * 2 ? ms / 3_600_000 : 1 / 60;
        energy += Math.abs(p) * hours;
        if (e.item === "pGrid") {
          if (p < 0) exportE += Math.abs(p) * hours;
          else importE += p * hours;
        }
      }
      byItem.set(e.item, Math.round(energy * 100) / 100);
      if (e.item === "pGrid") {
        console.log("pGrid export(to grid)", Math.round(exportE * 100) / 100, "import(from grid)", Math.round(importE * 100) / 100);
      }
    }
  }
  console.log("integrated |kWh| approx", Object.fromEntries(byItem));

  // Try other consumption-ish endpoints seen in SEMS+ UIs
  const more = [
    { path: "/sems-plant/api/v1/hems/energy/flow", body: { stationId: cfg.stationId, timeScale: 1, date: `${y}-${m}-${d}` } },
    { path: "/sems-plant/api/v1/hems/energy/statisticsV2", body: { stationId: cfg.stationId, timeScale: 1, date: `${y}-${m}-${d}` } },
    { path: "/sems-plant/api/stations/power-generation", body: { stationId: cfg.stationId, date: `${y}-${m}-${d}`, type: "day" } },
    { path: "/sems-plant/api/v1/plant/energy/statistics", body: { pwId: cfg.stationId, dateType: 0 } },
  ];
  for (const c of more) {
    try {
      const r = await client.request("POST", c.path, { body: c.body });
      console.log("\nOK", c.path, JSON.stringify(unwrap(r), null, 2).slice(0, 800));
    } catch (e) {
      console.log("\nFAIL", c.path, e instanceof Error ? e.message.slice(0, 120) : e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
