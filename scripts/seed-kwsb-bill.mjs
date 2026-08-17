/**
 * Seed KWSB Clifton Office water bill; remove Personal House KWSB account.
 * Run: node scripts/seed-kwsb-bill.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv(resolve(process.cwd(), ".env"));

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / service role key");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PDF =
  "c:/Users/User/Downloads/water bill clifton office .pdf";

const PROVIDER = "KWSB (Water Board) — Clifton Office";
const LEGACY_PERSONAL = "KWSB (Water Board) — Personal House";

// Remove Personal House KWSB (and any payments) — UI no longer shows it.
{
  const { data: legacy } = await supabase
    .from("utility_accounts")
    .select("id")
    .ilike("provider", LEGACY_PERSONAL);
  for (const row of legacy ?? []) {
    await supabase
      .from("utility_payment_logs")
      .delete()
      .eq("utility_account_id", row.id);
    await supabase.from("utility_accounts").delete().eq("id", row.id);
  }
  // Also remove plain "KWSB (Water Board)" if present as duplicate
  const { data: plain } = await supabase
    .from("utility_accounts")
    .select("id, provider")
    .eq("utility_type", "water")
    .ilike("provider", "%personal%");
  for (const row of plain ?? []) {
    await supabase
      .from("utility_payment_logs")
      .delete()
      .eq("utility_account_id", row.id);
    await supabase.from("utility_accounts").delete().eq("id", row.id);
  }
}

const bill = {
  accountNumber: "A 062 0196 000 A",
  consumerId: "65062019600084",
  paidOn: "2026-08-24",
  amount: 3748,
  billPeriod: "Jul-2026",
  invoice: "65062019600084",
  notes:
    "KWSB monthly bill Jul-2026. Consumer A.KARIM SONS — F.50/1 Block-8 Clifton. Consumer No A 062 0196 000 A / ID 65062019600084. Issue 04/08/2026. Due 24/08/2026. Water 3,432 + Sewerage 308 + bank 8 = Payable before due date 3,748 (after due 4,091). Plot size 500. Next due = paid_on + 1 month.",
};

let account;
{
  const { data: existing } = await supabase
    .from("utility_accounts")
    .select("*")
    .ilike("provider", PROVIDER)
    .limit(1)
    .maybeSingle();
  const payload = {
    utility_type: "water",
    provider: PROVIDER,
    billing_cycle: "monthly",
    account_number: bill.accountNumber,
    monthly_avg_cost: bill.amount,
    notes: `Site ${PROVIDER}. Consumer ID ${bill.consumerId}. Next due = last paid + 1 month.`,
  };
  if (existing) {
    const { data, error } = await supabase
      .from("utility_accounts")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    account = data;
  } else {
    const { data, error } = await supabase
      .from("utility_accounts")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    account = data;
  }
}

let payment;
{
  const { data: existingRows } = await supabase
    .from("utility_payment_logs")
    .select("*")
    .eq("utility_account_id", account.id)
    .eq("invoice_number", bill.invoice);
  const paymentPayload = {
    utility_account_id: account.id,
    paid_on: bill.paidOn,
    amount: bill.amount,
    units_kwh: null,
    bill_period: bill.billPeriod,
    invoice_number: bill.invoice,
    notes: bill.notes,
  };
  if (existingRows?.length) {
    const { data, error } = await supabase
      .from("utility_payment_logs")
      .update(paymentPayload)
      .eq("id", existingRows[0].id)
      .select("*")
      .single();
    if (error) throw error;
    payment = data;
  } else {
    const { data, error } = await supabase
      .from("utility_payment_logs")
      .insert(paymentPayload)
      .select("*")
      .single();
    if (error) throw error;
    payment = data;
  }
}

if (existsSync(PDF)) {
  const bytes = readFileSync(PDF);
  const storagePath = `${payment.id}/${Date.now()}-water_bill_clifton_office.pdf`;
  const { error: upErr } = await supabase.storage
    .from("utility-bills")
    .upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) {
    console.warn("PDF upload failed:", upErr.message);
  } else {
    const { data, error } = await supabase
      .from("utility_payment_logs")
      .update({ bill_file_url: storagePath })
      .eq("id", payment.id)
      .select("*")
      .single();
    if (error) throw error;
    payment = data;
  }
}

function addMonthsIso(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      removedPersonalHouse: true,
      site: "Clifton Office",
      accountId: account.id,
      accountNumber: account.account_number,
      consumerId: bill.consumerId,
      paidOn: payment.paid_on,
      amount: payment.amount,
      billPeriod: payment.bill_period,
      nextDue: addMonthsIso(payment.paid_on),
      billFile: payment.bill_file_url,
    },
    null,
    2,
  ),
);
