/**
 * List SEMS+ stations for configured credentials.
 * Run: npx tsx scripts/probe-sems-stations.ts [email] [password]
 */
import { config } from "dotenv";
config();
import { SemsClient } from "../lib/sems/client";
import { resolveRegion } from "../lib/sems/regions";

async function probe(email: string, password: string) {
  const region = resolveRegion(process.env.SEMS_SERVER?.trim() || "eu");
  const client = new SemsClient(region, email, password);
  const attempts: Array<{
    method: "GET" | "POST";
    path: string;
    query?: Record<string, string>;
    body?: unknown;
    base?: "gateway" | "user";
  }> = [
    { method: "GET", path: "/sems-plant/api/stations/list" },
    { method: "POST", path: "/sems-plant/api/stations/list", body: {} },
    { method: "POST", path: "/sems-plant/api/stations/list", body: { page: 1, pageSize: 50 } },
    { method: "GET", path: "/sems-plant/api/stations" },
    { method: "POST", path: "/sems-plant/api/stations", body: {} },
    { method: "GET", path: "/sems-plant/api/v1/plant/list" },
    { method: "POST", path: "/sems-plant/api/v1/plant/list", body: {} },
    { method: "GET", path: "/sems-plant/api/v1/plant/stations" },
    { method: "POST", path: "/sems-plant/api/v1/plant/stations", body: {} },
    { method: "GET", path: "/sems-plant/api/station/list" },
    { method: "GET", path: "/sems-plant/api/user/stations" },
    { method: "POST", path: "/sems-plant/api/user/stations", body: {} },
    { method: "GET", path: "/sems-plant/api/v1/station/list" },
    { method: "POST", path: "/sems-plant/api/v1/station/list", body: {} },
    { method: "POST", path: "/sems-plant/api/v1/station/page", body: { page: 1, pageSize: 50 } },
    { method: "POST", path: "/sems-plant/api/v1/station/pageList", body: { page: 1, pageSize: 50 } },
    { method: "GET", path: "/sems-user/api/v1/user/info", base: "user" },
    { method: "GET", path: "/sems-user/api/v1/user/detail", base: "user" },
    { method: "POST", path: "/sems-user/api/v1/user/stations", base: "user", body: {} },
    { method: "POST", path: "/sems-user/api/v1/station/list", base: "user", body: {} },
    { method: "POST", path: "/sems-user/api/v1/station/page", base: "user", body: { page: 1, pageSize: 50 } },
  ];
  console.log(`\n=== ${email} ===`);
  const session = await client.ensureLogin();
  console.log("session api:", session.api);
  for (const attempt of attempts) {
    const label = `${attempt.method} ${attempt.path}`;
    try {
      const path =
        attempt.base === "user"
          ? `${session.api.replace(/\/web\/sems$/, "")}/web/sems${attempt.path}`
          : attempt.path;
      const json = await client.request(attempt.method, path, {
        query: attempt.query,
        body: attempt.body,
      });
      console.log(label, JSON.stringify(json).slice(0, 1200));
    } catch (e) {
      console.log(
        label,
        "ERR",
        e instanceof Error ? e.message.slice(0, 160) : e,
      );
    }
  }
}

async function main() {
  const email = process.argv[2] ?? "Info@kafi-group.com";
  const password = process.argv[3] ?? "Trade2026";
  await probe(email, password);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
