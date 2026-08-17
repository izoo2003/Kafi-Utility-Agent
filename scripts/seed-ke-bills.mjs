/**
 * Seed K-Electric Jul-26 bills from Downloads PDFs into Supabase.
 * Run: node scripts/seed-ke-bills.mjs
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SECRET) in .env
 * and migration 20260817180000_utility_payment_bill_fields.sql applied.
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
loadEnv(resolve(process.cwd(), ".env.local"));

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL / service role key in .env");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DOWNLOADS = resolve("C:/Users/User/Downloads");

/** @type {Array<{
 *  provider: string;
 *  site: string;
 *  accountNumber: string;
 *  paidOn: string;
 *  amount: number;
 *  units: number;
 *  billPeriod: string;
 *  invoice: string;
 *  pdf: string | null;
 *  notes: string;
 * }>} */
const BILLS = [
  {
    provider: "K-Electric — SURWAY NO 239G Mill",
    site: "SURWAY NO 239G Mill",
    accountNumber: "0400044630832",
    paidOn: "2026-08-12",
    amount: 114590.06,
    units: 925,
    billPeriod: "Jul-26",
    invoice: "480020246083",
    pdf: "surway 239.pdf",
    notes:
      "KE e-bill Jul-26. Due within date 12-Aug-2026. KAFI COMMODITIES PVT LTD / S.NO 239 G Hub River Road Baldia. Next due = paid_on + 1 month.",
  },
  {
    provider: "K-Electric — SURWAY NO 234G Mill",
    site: "SURWAY NO 234G Mill",
    accountNumber: "0400023464886",
    paidOn: "2026-08-10",
    amount: 65221.09,
    units: 1099,
    billPeriod: "Jul-26",
    invoice: "712018584718",
    pdf: "surway 234.pdf",
    notes:
      "KE e-bill Jul-26. Due within date 10-Aug-2026. KAFI COMMODITIES (PTV) LTD / SURVEY NO 234 GOND PASS Baldia. Next due = paid_on + 1 month.",
  },
  {
    provider: "K-Electric — Clifton Office",
    site: "Clifton Office",
    accountNumber: "0400025196722",
    paidOn: "2026-08-10",
    amount: 0,
    units: 392,
    billPeriod: "Jul-26",
    invoice: "680018854328",
    pdf: "ke bill clifton office.pdf",
    notes:
      "KE e-bill Jul-26 from ke bill clifton office.pdf (Defence Phase-VI). Payable within due date Rs 0 (net-metering credit). Current charges 28,351.91 / 392 units. KHALID MEHMOOD PARACHA Acct 0400025196722. WARNING: identical file also saved under Personal House (home ke bill.pdf) — keep only the correct site.",
  },
  {
    provider: "K-Electric — Personal House",
    site: "Personal House",
    accountNumber: "0400025196722",
    paidOn: "2026-08-10",
    amount: 0,
    units: 392,
    billPeriod: "Jul-26",
    invoice: "680018854328",
    pdf: "home ke bill.pdf",
    notes:
      "KE e-bill Jul-26 from home ke bill.pdf. Payable within due date Rs 0 (net-metering credit). Current charges 28,351.91 / 392 units. Acct 0400025196722. WARNING: this PDF is byte-identical to ke bill clifton office.pdf (same Defence Phase-VI meter) — confirm whether this meter is Personal House or Clifton and delete the wrong site log if needed.",
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
    utility_type: "electricity",
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
  if (!bill.paidOn) return null;

  const { data: existingRows, error: findErr } = await supabase
    .from("utility_payment_logs")
    .select("*")
    .eq("utility_account_id", accountId)
    .eq("paid_on", bill.paidOn)
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

  if (bill.pdf) {
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

  return payment;
}

function addMonthsIso(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const results = [];
for (const bill of BILLS) {
  const account = await ensureAccount(bill);
  const payment = await upsertPayment(account.id, bill);
  results.push({
    site: bill.site,
    accountId: account.id,
    accountNumber: account.account_number,
    paidOn: payment?.paid_on ?? null,
    units: payment?.units_kwh ?? null,
    amount: payment?.amount ?? null,
    nextDue: payment?.paid_on ? addMonthsIso(payment.paid_on) : null,
    billFile: payment?.bill_file_url ?? null,
    note: bill.pdf ? null : bill.notes,
  });
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
