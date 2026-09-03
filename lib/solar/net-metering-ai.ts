import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  isGeminiKeyExhaustedError,
  isRetryableGeminiModelError,
  markGeminiKeyExhausted,
  markGeminiKeySuccess,
} from "@/lib/agent/models";
import {
  getGeminiModelCandidates,
  getNetMeteringGeminiApiKeys,
} from "@/lib/solar/net-metering-keys";

export type KeBillExtraction = {
  bill_period_label: string | null;
  bill_month: string | null;
  ke_account_number: string | null;
  consumer_name: string | null;
  net_metering_rs: number | null;
  consumed_rs: number | null;
  previous_balance_rs: number | null;
  payable_rs: number | null;
  units_import_kwh: number | null;
  units_export_kwh: number | null;
  current_charges_rs: number | null;
  confidence: "high" | "medium" | "low";
  extraction_notes: string | null;
};

export type NetMeteringAiResult = {
  extraction: KeBillExtraction;
  narrative: string;
  model: string;
};

const EXTRACTION_PROMPT = `You are a K-Electric (KE) net-metering bill analyst for a solar-equipped facility in Pakistan.

Read the uploaded K-Electric bill PDF carefully (all pages). Extract ONLY values visible on the bill.

Return a single JSON object (no markdown fences) with this exact shape:
{
  "bill_period_label": "Jul-26 or null",
  "bill_month": "YYYY-MM or null",
  "ke_account_number": "string or null",
  "consumer_name": "string or null",
  "net_metering_rs": number or null,
  "consumed_rs": number or null,
  "previous_balance_rs": number or null,
  "payable_rs": number or null,
  "units_import_kwh": number or null,
  "units_export_kwh": number or null,
  "current_charges_rs": number or null,
  "confidence": "high" | "medium" | "low",
  "extraction_notes": "brief note on which bill lines you used"
}

Field guidance for net metering spreadsheets (amounts in Pakistani Rupees):
- net_metering_rs: monetary CREDIT from solar export / net metering / generation fed to grid (Rs credited this month). Look for export credit, net metering adjustment, generation credit, or similar positive credit lines.
- consumed_rs: monetary DEBIT for grid electricity consumed/imported this month (Rs). Often "current charges", import energy charges, or consumption amount before credits.
- previous_balance_rs: carry-forward / previous dues / opening balance if printed on the bill.
- payable_rs: amount payable within due date (often Rs 0 when credit covers the bill).
- units_import_kwh / units_export_kwh: kWh if shown separately.

If a field is not on the bill, use null. Do not invent numbers.
Parse amounts without commas. bill_month should be ISO YYYY-MM when inferable from bill period.`;

function parseJsonBlock(text: string): KeBillExtraction {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1]!.trim() : trimmed;
  const parsed = JSON.parse(raw) as KeBillExtraction;
  return {
    bill_period_label: parsed.bill_period_label ?? null,
    bill_month: parsed.bill_month ?? null,
    ke_account_number: parsed.ke_account_number ?? null,
    consumer_name: parsed.consumer_name ?? null,
    net_metering_rs:
      parsed.net_metering_rs != null ? Number(parsed.net_metering_rs) : null,
    consumed_rs:
      parsed.consumed_rs != null ? Number(parsed.consumed_rs) : null,
    previous_balance_rs:
      parsed.previous_balance_rs != null
        ? Number(parsed.previous_balance_rs)
        : null,
    payable_rs: parsed.payable_rs != null ? Number(parsed.payable_rs) : null,
    units_import_kwh:
      parsed.units_import_kwh != null ? Number(parsed.units_import_kwh) : null,
    units_export_kwh:
      parsed.units_export_kwh != null ? Number(parsed.units_export_kwh) : null,
    current_charges_rs:
      parsed.current_charges_rs != null
        ? Number(parsed.current_charges_rs)
        : null,
    confidence: parsed.confidence ?? "medium",
    extraction_notes: parsed.extraction_notes ?? null,
  };
}

function buildNarrativePrompt(
  extraction: KeBillExtraction,
  calc: {
    previous_balance_rs: number;
    gross_balance_rs: number;
    net_balance_rs: number;
    estimated_refund_rs: number;
    monthly_delta_rs: number;
  },
  semsExportKwh: number | null,
  plantLabel?: string | null,
) {
  return `Write a concise net metering briefing (150–220 words) for facility ops.

Use ONLY these facts:
Plant / ledger: ${plantLabel?.trim() || "unknown"}
Bill period: ${extraction.bill_period_label ?? "unknown"} (${extraction.bill_month ?? "?"})
Account: ${extraction.ke_account_number ?? "?"}
Consumer: ${extraction.consumer_name ?? "?"}
Net metering credit (Rs): ${extraction.net_metering_rs ?? "?"}
Grid consumed cost (Rs): ${extraction.consumed_rs ?? "?"}
Previous balance (Rs): ${calc.previous_balance_rs}
Monthly delta (credit − consumed): ${calc.monthly_delta_rs}
Gross balance: ${calc.gross_balance_rs}
Net balance after refund: ${calc.net_balance_rs}
Estimated refundable from KE: ${calc.estimated_refund_rs}
Payable on bill: ${extraction.payable_rs ?? "?"}
SEMS grid export kWh (same month, if any): ${semsExportKwh ?? "not linked"}

Explain in plain language:
1) What this month's net metering means for savings
2) Running credit balance and whether a KE refund is likely
3) One practical next step (e.g. apply for refund when balance is high)

Do not invent numbers not listed above.`;
}

export async function extractKeBillFromPdf(
  pdfBase64: string,
  fileName: string,
): Promise<{ extraction: KeBillExtraction; model: string }> {
  const keys = getNetMeteringGeminiApiKeys();
  if (!keys.length) {
    throw new Error(
      "Missing GEMINI_NET_METERING_API_KEY or GEMINI_API_KEY in .env",
    );
  }

  const models = getGeminiModelCandidates();
  let lastError: unknown;

  for (const entry of keys) {
    const genAI = new GoogleGenerativeAI(entry.key);
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });
        const result = await model.generateContent([
          { text: EXTRACTION_PROMPT },
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          { text: `File name: ${fileName}` },
        ]);
        const text = result.response.text()?.trim();
        if (!text) throw new Error("Empty extraction response");
        markGeminiKeySuccess(entry.index);
        return { extraction: parseJsonBlock(text), model: modelName };
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
    : new Error("Failed to extract KE bill data");
}

export async function generateNetMeteringNarrative(
  extraction: KeBillExtraction,
  calc: {
    previous_balance_rs: number;
    gross_balance_rs: number;
    net_balance_rs: number;
    estimated_refund_rs: number;
    monthly_delta_rs: number;
  },
  semsExportKwh: number | null,
  plantLabel?: string | null,
): Promise<{ narrative: string; model: string }> {
  const keys = getNetMeteringGeminiApiKeys();
  if (!keys.length) {
    throw new Error("Missing Gemini API key for net metering narrative");
  }

  const models = getGeminiModelCandidates();
  const prompt = buildNarrativePrompt(
    extraction,
    calc,
    semsExportKwh,
    plantLabel,
  );
  let lastError: unknown;

  for (const entry of keys) {
    const genAI = new GoogleGenerativeAI(entry.key);
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.2 },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text()?.trim();
        if (!text) throw new Error("Empty narrative response");
        markGeminiKeySuccess(entry.index);
        return { narrative: text, model: modelName };
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
    : new Error("Failed to generate net metering narrative");
}

export async function analyzeKeBillForNetMetering(
  pdfBase64: string,
  fileName: string,
  calc: {
    previous_balance_rs: number;
    gross_balance_rs: number;
    net_balance_rs: number;
    estimated_refund_rs: number;
    monthly_delta_rs: number;
  },
  semsExportKwh: number | null,
): Promise<NetMeteringAiResult> {
  const { extraction, model } = await extractKeBillFromPdf(
    pdfBase64,
    fileName,
  );
  const { narrative } = await generateNetMeteringNarrative(
    extraction,
    calc,
    semsExportKwh,
  );
  return { extraction, narrative, model };
}
