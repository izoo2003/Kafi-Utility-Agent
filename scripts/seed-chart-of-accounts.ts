/**
 * Seed Chart of Accounts ledgers from the four Excel (HTML) exports only.
 * Run: npx tsx scripts/seed-chart-of-accounts.ts
 *
 * Requires SUPABASE_URL + service role key, and migration
 * 20260828120000_chart_of_accounts.sql applied.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ChartOfAccountsLedger } from "../lib/types/database";
import { normalizeToIsoDate, parseLooseNumber } from "../lib/validations/helpers";

config();

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

const SEED_DIR = join(__dirname, "seed-data", "chart-of-accounts");

const FILES: Array<{ file: string; ledger: ChartOfAccountsLedger }> = [
  { file: "solar-panel-clifton.xls", ledger: "solar_panel_clifton" },
  { file: "eobi.xls", ledger: "eobi" },
  { file: "k-electric-gondpass.xls", ledger: "k_electric_gondpass" },
  { file: "kwsb-clifton.xls", ledger: "kwsb_clifton" },
];

type ParsedRow = {
  entry_date: string;
  ref_no: string | null;
  account_description: string | null;
  document_no: string | null;
  debit: number;
  credit: number;
  notes: string | null;
};

function parseHtmlTables(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  const cellRe = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(html))) {
    const tr = trMatch[0];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cellMatch = cellRe.exec(tr))) {
      const raw = cellMatch[2]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(raw);
    }
    if (cells.some((c) => c.length > 0)) rows.push(cells);
  }
  return rows;
}

function parseMoney(value: string | undefined): number {
  if (!value || !value.trim()) return 0;
  const n = parseLooseNumber(value);
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function isSkipRow(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  if (joined.includes("starting date") || joined.includes("ending date")) {
    return true;
  }
  if (/^to$/i.test(cells[1] ?? "")) return true;
  const first = (cells[0] || "").toLowerCase();
  const second = (cells[1] || "").toLowerCase();
  if (first === "date" && second.includes("ref")) return true;
  if (second.startsWith("total") || second.includes("reporting period")) {
    return true;
  }
  if (first.startsWith("total") || first.includes("reporting period")) {
    return true;
  }
  return false;
}

function parseLedgerRows(html: string): ParsedRow[] {
  const table = parseHtmlTables(html);
  const out: ParsedRow[] = [];

  for (const cells of table) {
    if (isSkipRow(cells)) continue;

    // Excel HTML exports often have 9 cells:
    // Date | Ref | Accounts | Document# | (extra) | Debit | Credit | Balance | Action
    const dateRaw = cells[0] ?? "";
    const iso = normalizeToIsoDate(dateRaw);
    if (!iso) continue;

    const ref_no = (cells[1] || "").trim() || null;
    const account_description = (cells[2] || "").trim() || null;
    const document_no = (cells[3] || "").trim() || null;
    const extra = (cells[4] || "").trim();

    let debit: number;
    let credit: number;
    let notes: string | null = null;

    if (cells.length >= 8) {
      // Prefer amount columns near the end (before balance/action)
      debit = parseMoney(cells[5]);
      credit = parseMoney(cells[6]);
      if (extra && !/^\d/.test(extra) && extra.toLowerCase() !== "show") {
        notes = extra;
      }
      // If col5 looks empty and col4 is numeric, shifted layout without extra col
      if (
        debit === 0 &&
        credit === 0 &&
        parseMoney(cells[4]) === 0 &&
        cells.length === 8
      ) {
        debit = parseMoney(cells[4]);
        credit = parseMoney(cells[5]);
      }
    } else {
      debit = parseMoney(cells[4]);
      credit = parseMoney(cells[5]);
    }

    // Opening / close rows still valid even with 0 debit/credit
    out.push({
      entry_date: iso,
      ref_no,
      account_description,
      document_no,
      debit,
      credit,
      notes,
    });
  }

  return out;
}

function matchKey(row: {
  ledger: string;
  entry_date: string;
  ref_no: string | null;
  account_description: string | null;
  document_no: string | null;
  debit: number;
  credit: number;
}) {
  return [
    row.ledger,
    row.entry_date,
    (row.ref_no || "").toLowerCase(),
    (row.account_description || "").toLowerCase(),
    (row.document_no || "").toLowerCase(),
    String(row.debit),
    String(row.credit),
  ].join("|");
}

async function seedLedger(
  ledger: ChartOfAccountsLedger,
  filePath: string,
): Promise<void> {
  const raw = readFileSync(filePath);
  let html: string | null = null;
  for (const enc of ["utf-8", "utf-16le", "latin1"] as const) {
    try {
      html = raw.toString(enc);
      if (html.includes("<tr") || html.includes("<TR")) break;
    } catch {
      html = null;
    }
  }
  if (!html) throw new Error(`Could not decode ${filePath}`);

  const rows = parseLedgerRows(html);
  console.log(`${ledger}: parsed ${rows.length} rows from ${filePath}`);

  const { data: existing, error: listError } = await supabase
    .from("chart_of_accounts_entries")
    .select(
      "id, ledger, entry_date, ref_no, account_description, document_no, debit, credit",
    )
    .eq("ledger", ledger);
  if (listError) throw new Error(listError.message);

  const existingKeys = new Set(
    (existing ?? []).map((r) =>
      matchKey({
        ledger: r.ledger,
        entry_date: r.entry_date,
        ref_no: r.ref_no,
        account_description: r.account_description,
        document_no: r.document_no,
        debit: Number(r.debit) || 0,
        credit: Number(r.credit) || 0,
      }),
    ),
  );

  const toInsert = rows
    .map((r) => ({
      ledger,
      entry_date: r.entry_date,
      ref_no: r.ref_no,
      account_description: r.account_description,
      document_no: r.document_no,
      debit: r.debit,
      credit: r.credit,
      notes: r.notes,
    }))
    .filter((r) => !existingKeys.has(matchKey(r)));

  if (toInsert.length === 0) {
    console.log(`${ledger}: nothing new to insert (${existing?.length ?? 0} already present)`);
    return;
  }

  const chunkSize = 50;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("chart_of_accounts_entries")
      .insert(chunk);
    if (error) throw new Error(`${ledger} insert failed: ${error.message}`);
    inserted += chunk.length;
  }
  console.log(
    `${ledger}: inserted ${inserted} (skipped ${rows.length - toInsert.length} duplicates)`,
  );
}

async function main() {
  const present = new Set(readdirSync(SEED_DIR));
  for (const { file, ledger } of FILES) {
    if (!present.has(file)) {
      throw new Error(`Missing seed file: ${join(SEED_DIR, file)}`);
    }
    await seedLedger(ledger, join(SEED_DIR, file));
  }
  console.log("Chart of Accounts seed complete.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
