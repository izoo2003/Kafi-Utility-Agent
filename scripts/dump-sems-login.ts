/**
 * Dump SEMS+ login JSON (may include default station).
 * Run: npx tsx scripts/dump-sems-login.ts [email] [password] [server]
 */
import { config } from "dotenv";
config();
import { randomUUID } from "node:crypto";
import { hashPasswordForSemsPlus } from "../lib/sems/signature";
import { semsBrowserHeaders } from "../lib/sems/auth";
import { resolveRegion } from "../lib/sems/regions";

async function main() {
  const email = process.argv[2] ?? "Info@kafi-group.com";
  const password = process.argv[3] ?? "Trade2026";
  const server = process.argv[4] ?? "hk";
  const region = resolveRegion(server);
  const deviceId = randomUUID();
  const emptyToken = JSON.stringify({
    uid: "",
    timestamp: 0,
    token: "",
    client: "semsPlusWeb",
    version: "",
    language: "en",
  });
  const url = `${region.webOrigin}/web/sems/sems-user/api/v1/auth/cross-login`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...semsBrowserHeaders(region.webOrigin, emptyToken, "", "", deviceId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account: email,
      pwd: hashPasswordForSemsPlus(password),
      agreement: 1,
      isLocal: false,
      isChinese: false,
    }),
  });
  const text = await response.text();
  console.log("status", response.status);
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
