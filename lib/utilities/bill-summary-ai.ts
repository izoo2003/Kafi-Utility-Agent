import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  isGeminiKeyExhaustedError,
  isRetryableGeminiModelError,
  markGeminiKeyExhausted,
  markGeminiKeySuccess,
} from "@/lib/agent/models";
import {
  getBillSummaryGeminiApiKeys,
  getBillSummaryModelCandidates,
} from "@/lib/utilities/bill-summary-keys";
import type { BillComparison } from "@/lib/utilities/bill-comparison";
import { formatPct, formatSigned } from "@/lib/utilities/bill-comparison";

export type BillSummaryAiResult = {
  summary: string;
  model: string;
};

function line(label: string, value: string | number | null | undefined) {
  if (value == null || value === "") return `${label}: (not recorded)`;
  return `${label}: ${value}`;
}

function buildPrompt(input: {
  providerLabel: string;
  siteLabel: string;
  utilityType: string;
  unitsLabel: string;
  comparison: BillComparison;
}): string {
  const { current, previous, recent } = input.comparison;
  const history = recent
    .map(
      (row, i) =>
        `${i + 1}. paid ${row.paid_on}${row.bill_period ? ` (${row.bill_period})` : ""} — amount ${row.amount ?? "?"} — ${input.unitsLabel} ${row.units ?? "?"}${row.invoice_number ? ` — inv ${row.invoice_number}` : ""}`,
    )
    .join("\n");

  return `You are a facility ops analyst for utility bills in Pakistan (amounts in PKR / Rs).

Utility: ${input.providerLabel}
Site section: ${input.siteLabel}
Type: ${input.utilityType}

Write a practical bill summary (180–280 words) with these exact headings:

## Why this bill
Explain why the latest bill is this amount — units, period, notes, and (if a bill image/PDF is attached) line items such as units, fuel adjustment, taxes, arrears, or extra tanker/trips. Do not invent causes that are not in the data or the attachment.

## vs previous bill
Compare this bill to the immediately previous one (amount, units, period). Say if it is higher, lower, or the first bill on record.

## Difference
State the numeric difference clearly (amount delta and % if available; units delta and % if available).

## What to watch
1–3 concrete next steps (e.g. check a spike, keep logging units, compare next cycle).

Use ONLY these facts. Never invent amounts, units, invoice numbers, or dates.

This bill:
${line("Paid on", current?.paid_on)}
${line("Bill period", current?.bill_period)}
${line("Amount (Rs)", current?.amount)}
${line(input.unitsLabel, current?.units)}
${line("Invoice", current?.invoice_number)}
${line("Notes", current?.notes)}
Bill file attached: ${current?.has_bill_file ? "yes — read it if provided" : "no"}

Previous bill:
${previous ? `${line("Paid on", previous.paid_on)}
${line("Bill period", previous.bill_period)}
${line("Amount (Rs)", previous.amount)}
${line(input.unitsLabel, previous.units)}
${line("Invoice", previous.invoice_number)}
${line("Notes", previous.notes)}` : "(none — this is the first recorded bill)"}

Computed difference:
- Amount delta: ${formatSigned(input.comparison.amount_delta)} (${formatPct(input.comparison.amount_pct)})
- ${input.unitsLabel} delta: ${formatSigned(input.comparison.units_delta)} (${formatPct(input.comparison.units_pct)})

Recent bills (newest first):
${history || "(none)"}`;
}

export async function generateUtilityBillSummary(input: {
  providerLabel: string;
  siteLabel: string;
  utilityType: string;
  unitsLabel: string;
  comparison: BillComparison;
  billFile?: { mimeType: string; base64: string; fileName: string } | null;
}): Promise<BillSummaryAiResult> {
  const keys = getBillSummaryGeminiApiKeys();
  if (!keys.length) {
    throw new Error(
      "Missing GEMINI_BILL_SUMMARY_API_KEY or GEMINI_API_KEY in .env",
    );
  }

  const models = getBillSummaryModelCandidates();
  const prompt = buildPrompt(input);
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  if (input.billFile) {
    parts.push({
      inlineData: {
        mimeType: input.billFile.mimeType,
        data: input.billFile.base64,
      },
    });
    parts.push({ text: `Attached bill file: ${input.billFile.fileName}` });
  }

  let lastError: unknown;

  for (const entry of keys) {
    const genAI = new GoogleGenerativeAI(entry.key);
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.2 },
        });
        const result = await model.generateContent(parts);
        const text = result.response.text()?.trim();
        if (!text) throw new Error("Empty bill summary response");
        markGeminiKeySuccess(entry.index);
        return { summary: text, model: modelName };
      } catch (error) {
        lastError = error;
        if (isGeminiKeyExhaustedError(error)) {
          markGeminiKeyExhausted(entry.index);
          break;
        }
        if (!isRetryableGeminiModelError(error)) throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to generate bill summary");
}
