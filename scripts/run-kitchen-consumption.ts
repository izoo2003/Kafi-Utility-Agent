import { config } from "dotenv";
config();
import { createClient } from "@supabase/supabase-js";
import { applyDailyKitchenConsumption } from "../lib/kitchen/apply-daily-consumption";

async function main() {
  const u = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const k =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!u || !k) throw new Error("Missing Supabase env");
  const s = createClient(u, k);
  const r = await applyDailyKitchenConsumption(s);
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
