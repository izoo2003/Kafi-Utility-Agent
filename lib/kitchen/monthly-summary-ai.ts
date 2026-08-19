import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getGeminiModelCandidates,
  getOrderedGeminiApiKeys,
  isGeminiKeyExhaustedError,
  isRetryableGeminiModelError,
  markGeminiKeyExhausted,
  markGeminiKeySuccess,
} from "@/lib/agent/models";
import type { KitchenEdaAnalytics } from "@/lib/kitchen/eda-analytics";
import type { MonthlyConsumptionReport } from "@/lib/kitchen/monthly-consumption";

export type KitchenEdaInsightResult = {
  month: string;
  summary: string;
  model: string;
};

function buildEdaPrompt(eda: KitchenEdaAnalytics): string {
  const top = eda.top_out_items
    .slice(0, 12)
    .map(
      (i) =>
        `- ${i.name}${i.unit ? ` (${i.unit})` : ""}: Out=${i.out}, In=${i.in}`,
    )
    .join("\n");

  const cats = eda.category_mix
    .slice(0, 8)
    .map((c) => `- ${c.category}: Out=${c.out}, In=${c.in}, items=${c.items}`)
    .join("\n");

  const trend = eda.month_trend
    .map((m) => `- ${m.month}: In=${m.in}, Out=${m.out}`)
    .join("\n");

  const dailyPeaks = [...eda.daily_flow]
    .filter((d) => d.out_qty > 0)
    .sort((a, b) => b.out_qty - a.out_qty)
    .slice(0, 5)
    .map((d) => `- ${d.date}: Out=${d.out_qty}, In=${d.in_qty}`)
    .join("\n");

  const alerts = eda.alerts
    .map((a) => `- [${a.severity}] ${a.title}: ${a.detail}`)
    .join("\n");

  const low = eda.report.lines
    .filter((l) => l.status === "out" || l.status === "low")
    .map(
      (l) =>
        `- ${l.item_name}: stock=${l.stock_now}, status=${l.status}, Out month=${l.qty_out_month}`,
    )
    .join("\n");

  return `You are a facility operations analyst doing Exploratory Data Analysis (EDA) for one office kitchen (~20 staff).

Month: ${eda.month} (${eda.report.start_date} → ${eda.report.end_date})
Stock model: Stock = In − Out. Do NOT invent numbers; use only the analytics below.

Write a practical EDA briefing (220–340 words) with these exact sections:

## Key findings
2–4 bullets on what the charts would show (daily flow, top Out items, category mix, 6-month trend).

## Alerts & risks
Prioritize stockouts, low stock, restock lag, and unusual spikes. Tie each alert to data.

## Consumption trends
Comment on daily pattern, peak days, month-over-month direction, and whether In is keeping up with Out.

## Actions for next 2 weeks
3–5 concrete ops actions (what to restock, what to watch, what to record better).

KPIs:
- Avg daily Out: ${eda.kpis.avg_daily_out}
- Peak Out: ${eda.kpis.peak_out_qty} on ${eda.kpis.peak_out_day ?? "n/a"}
- Restock coverage (In/Out %): ${eda.kpis.restock_coverage_pct ?? "n/a"}
- Active days: ${eda.kpis.days_with_activity}
- Items Out of stock: ${eda.kpis.items_out_of_stock}
- Items Low: ${eda.kpis.items_low}
- Month In sum: ${eda.report.totals.qty_in_sum}
- Month Out sum: ${eda.report.totals.qty_out_sum}
- Est. Out cost: ${eda.report.totals.estimated_out_cost_sum ?? "n/a"}

Rule-based alerts already detected:
${alerts || "(none)"}

Top Out items:
${top || "(none)"}

Category mix (Out):
${cats || "(none)"}

6-month In/Out trend:
${trend || "(none)"}

Highest Out days this month:
${dailyPeaks || "(none)"}

Low / empty now:
${low || "(none)"}`;
}

async function generateText(prompt: string): Promise<{ text: string; model: string }> {
  const keys = getOrderedGeminiApiKeys();
  if (!keys.length) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to .env to enable AI inventory insights.",
    );
  }

  const models = getGeminiModelCandidates();
  let lastError: unknown;

  for (const entry of keys) {
    const genAI = new GoogleGenerativeAI(entry.key);
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text()?.trim();
        if (!text) throw new Error("Empty AI response");
        markGeminiKeySuccess(entry.index);
        return { text, model: modelName };
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
    : new Error("Failed to generate AI insights");
}

export async function generateKitchenEdaInsights(
  eda: KitchenEdaAnalytics,
): Promise<KitchenEdaInsightResult> {
  const { text, model } = await generateText(buildEdaPrompt(eda));
  return { month: eda.month, summary: text, model };
}

/** Fallback when only a monthly report is available (no full EDA). */
export async function generateMonthlyConsumptionSummary(
  report: MonthlyConsumptionReport,
): Promise<KitchenEdaInsightResult> {
  const top = report.lines
    .filter((l) => l.qty_out_month > 0)
    .slice(0, 20)
    .map(
      (l) =>
        `- ${l.item_name}: Out ${l.qty_out_month}, In ${l.qty_in_month}, stock ${l.stock_now}, status=${l.status}`,
    )
    .join("\n");

  const prompt = `Kitchen monthly summary for ${report.month}. Stock = In − Out. Use only this data.
Write Key findings, Alerts, Trends, and Actions (concise).
Totals: Out=${report.totals.qty_out_sum}, In=${report.totals.qty_in_sum}, cost=${report.totals.estimated_out_cost_sum ?? "n/a"}
Lines:
${top || "(none)"}`;

  const { text, model } = await generateText(prompt);
  return { month: report.month, summary: text, model };
}
