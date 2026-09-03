import {
  DEFAULT_GEMINI_MODELS,
  getGeminiApiKeys,
  getOrderedGeminiApiKeys,
} from "@/lib/agent/models";

/** Dedicated Gemini key for utility bill summaries (falls back to main keys). */
export function getBillSummaryGeminiApiKeys(): Array<{
  key: string;
  label: string;
  index: number;
}> {
  const dedicated = process.env.GEMINI_BILL_SUMMARY_API_KEY?.trim();
  if (dedicated) {
    const fallback = getGeminiApiKeys().filter((k) => k !== dedicated);
    return [
      { key: dedicated, label: "bill-summary", index: 0 },
      ...fallback.map((key, i) => ({
        key,
        label: `fallback-${i + 1}`,
        index: i + 1,
      })),
    ];
  }
  return getOrderedGeminiApiKeys();
}

/**
 * Base model first, then dedicated fallbacks, then the shared Gemini list.
 * GEMINI_BILL_SUMMARY_MODEL → GEMINI_BILL_SUMMARY_FALLBACK_MODELS → defaults.
 */
export function getBillSummaryModelCandidates(): string[] {
  const preferred = process.env.GEMINI_BILL_SUMMARY_MODEL?.trim();
  const fromEnv =
    process.env.GEMINI_BILL_SUMMARY_FALLBACK_MODELS?.split(",")
      .map((m) => m.trim())
      .filter(Boolean) ?? [];

  const ordered = [
    ...(preferred ? [preferred] : []),
    ...fromEnv,
    ...DEFAULT_GEMINI_MODELS,
  ];

  return [...new Set(ordered)];
}
