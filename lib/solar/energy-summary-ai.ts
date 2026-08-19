import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getGeminiModelCandidates,
  getOrderedGeminiApiKeys,
  isGeminiKeyExhaustedError,
  isRetryableGeminiModelError,
  markGeminiKeyExhausted,
  markGeminiKeySuccess,
} from "@/lib/agent/models";
import type { SolarEnergySummary } from "@/lib/solar/energy-summary";

export type SolarEnergyAiResult = {
  month: string;
  summary: string;
  model: string;
};

function buildPrompt(summary: SolarEnergySummary): string {
  const trend = summary.month_trend
    .map(
      (m) =>
        `- ${m.month}: generated=${m.generated_kwh} kWh, consumed=${m.consumed_kwh} kWh, exported=${m.exported_kwh} kWh (${m.source})`,
    )
    .join("\n");

  const alerts = summary.alerts
    .map((a) => `- [${a.severity}] ${a.title}: ${a.detail}`)
    .join("\n");

  const topDays = [...summary.daily]
    .filter((d) => d.generated_kwh > 0)
    .sort((a, b) => b.generated_kwh - a.generated_kwh)
    .slice(0, 5)
    .map(
      (d) =>
        `- ${d.date}: gen=${d.generated_kwh}, consumed=${d.consumed_kwh}, export=${d.exported_kwh}`,
    )
    .join("\n");

  return `You are a facility energy analyst for one office solar plant${
    summary.station_name ? ` (${summary.station_name})` : ""
  }.

Write a clear monthly Solar Energy Summary for ${summary.month} (${summary.start_date} → ${summary.end_date}).
Use ONLY the numbers below. Do not invent units. Prefer kWh (or MWh if large). Keep it practical (220–320 words).

Use these exact sections:

## Monthly totals
State Monthly Generated Units, Monthly Consumed Units, and Units Supplied/Exported to the Grid.

## Month-over-month comparison
Compare generated, consumed, and exported vs last month (include % changes when available).

## What the mix means
Explain self-consumption vs export, and whether the site is covering its load or importing.

## Alerts & guidance
Call out risks or opportunities, then give 3 concrete actions for next month.

Data:
- Generated: ${summary.generated_kwh ?? 0} kWh
- Consumed: ${summary.consumed_kwh ?? 0} kWh
- Exported to grid: ${summary.exported_kwh ?? 0} kWh
- To Load: ${summary.to_load_kwh ?? 0} kWh
- From Grid: ${summary.from_grid_kwh ?? 0} kWh
- Self-consumption %: ${summary.self_consumption_pct ?? "n/a"}
- Export % of generation: ${summary.export_pct ?? "n/a"}
- vs prev generated %: ${summary.vs_prev.generated_pct ?? "n/a"}
- vs prev consumed %: ${summary.vs_prev.consumed_pct ?? "n/a"}
- vs prev exported %: ${summary.vs_prev.exported_pct ?? "n/a"}
- Previous month label: ${summary.previous?.label ?? "n/a"}
- Previous generated/consumed/exported: ${summary.previous?.generated_kwh ?? 0} / ${summary.previous?.consumed_kwh ?? 0} / ${summary.previous?.exported_kwh ?? 0}

6-month trend:
${trend || "(none)"}

Rule alerts:
${alerts || "(none)"}

Top generation days (from logs):
${topDays || "(none)"}`;
}

export async function generateSolarEnergySummaryAi(
  summary: SolarEnergySummary,
): Promise<SolarEnergyAiResult> {
  const keys = getOrderedGeminiApiKeys();
  if (!keys.length) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to .env to enable AI solar summaries.",
    );
  }

  const models = getGeminiModelCandidates();
  let lastError: unknown;

  for (const entry of keys) {
    const genAI = new GoogleGenerativeAI(entry.key);
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(buildPrompt(summary));
        const text = result.response.text()?.trim();
        if (!text) throw new Error("Empty AI response");
        markGeminiKeySuccess(entry.index);
        return { month: summary.month, summary: text, model: modelName };
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
    : new Error("Failed to generate solar energy summary");
}
