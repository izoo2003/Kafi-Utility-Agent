/**
 * Seed SSGC Jul-2026 bills into Clifton Office + KMP House.
 * Run: node scripts/seed-ssgc-bills.mjs
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
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL / service role key");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DOWNLOADS = resolve("C:/Users/User/Downloads");

const BILLS = [
  {
    provider: "SSGC (Gas) — Clifton Office",
    site: "Clifton Office",
    accountNumber: "5527820000",
    paidOn: "2026-08-17",
    amount: 1370,
    units: 4,
    billPeriod: "Jul-2026",
    invoice: "552127730429",
    pdf: "gas clifton office.pdf",
    notes:
      "SSGC gas bill Jul-2026. Customer KAFI COMMODITIES (PVT) LTD — Qasre Faisal F 50/1 Block 8 Clifton. Customer No 5527820000. Bill ID 552127730429. Measured 4 CM / 0.139545 MMBTU. Total current charges 1,372; amount within due date 1,370. Due 17-Aug-2026. Issue 01-Aug-26. Meter 18482484. Next due = paid_on + 1 month.",
  },
  {
    provider: "SSGC (Gas) — KMP House",
    site: "KMP House",
    accountNumber: "8330716652",
    paidOn: "2026-08-13",
    amount: 1370,
    units: 13,
    billPeriod: "Jul-2026",
    invoice: "833441753974",
    pdf: "home gas bill.pdf",
    notes:
      "SSGC gas bill Jul-2026. Customer KHALID MEHMOOD PARACHA — H No 94/II Phase VI Khayaban-e-Muhafiz DHA. Customer No 8330716652. Bill ID 833441753974. Measured 13 CM / 0.435662 MMBTU. Total current charges 1,372; amount within due date 1,370. Due 13-Aug-2026. Issue 29-Jul-2026. Meter A5256718. Next due = paid_on + 1 month.",
  },
];

async function ensureAccount(bill) {
  const { data: existing, error: listErr } = await supabase
    .from("utility_accounts")
    .select("*")
    .ilike("provider", bill.provider)
    .limit(1)
    .maybeSingle();
  if (listErr) throw listErr;

  const payload = {
    utility_type: "gas",
    provider: bill.provider,
    billing_cycle: "monthly",
    account_number: bill.accountNumber,
    monthly_avg_cost: bill.amount,
    notes: `Site ${bill.provider}. Next due = last paid + 1 month.`,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("utility_accounts")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("utility_accounts")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function upsertPayment(accountId, bill) {
  const { data: existingRows, error: findErr } = await supabase
    .from("utility_payment_logs")
    .select("*")
    .eq("utility_account_id", accountId)
    .eq("invoice_number", bill.invoice);
  if (findErr) throw findErr;

  const paymentPayload = {
    utility_account_id: accountId,
    paid_on: bill.paidOn,
    amount: bill.amount,
    units_kwh: bill.units,
    bill_period: bill.billPeriod,
    invoice_number: bill.invoice,
    notes: bill.notes,
  };

  let payment;
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

  const pdfPath = resolve(DOWNLOADS, bill.pdf);
  if (!existsSync(pdfPath)) {
    console.warn(`PDF missing: ${pdfPath}`);
    return payment;
  }
  const bytes = readFileSync(pdfPath);
  const storagePath = `${payment.id}/${Date.now()}-${bill.pdf.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: upErr } = await supabase.storage
    .from("utility-bills")
    .upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) {
    console.warn(`Upload failed for ${bill.site}: ${upErr.message}`);
    return payment;
  }
  const { data: updated, error: linkErr } = await supabase
    .from("utility_payment_logs")
    .update({ bill_file_url: storagePath })
    .eq("id", payment.id)
    .select("*")
    .single();
  if (linkErr) throw linkErr;
  return updated;
}

function addMonthsIso(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

const results = [];
for (const bill of BILLS) {
  const account = await ensureAccount(bill);
  const payment = await upsertPayment(account.id, bill);
  results.push({
    site: bill.site,
    accountId: account.id,
    accountNumber: account.account_number,
    paidOn: payment.paid_on,
    unitsCm: payment.units_kwh,
    amount: payment.amount,
    invoice: payment.invoice_number,
    nextDue: addMonthsIso(payment.paid_on),
    billFile: payment.bill_file_url,
  });
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
