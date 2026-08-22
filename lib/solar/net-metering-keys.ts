import {
  getGeminiApiKeys,
  getGeminiModelCandidates,
  getOrderedGeminiApiKeys,
} from "@/lib/agent/models";

/** Dedicated Gemini key for net metering bill OCR (falls back to main keys). */
export function getNetMeteringGeminiApiKeys(): Array<{
  key: string;
  label: string;
  index: number;
}> {
  const dedicated = process.env.GEMINI_NET_METERING_API_KEY?.trim();
  if (dedicated) {
    const fallback = getGeminiApiKeys().filter((k) => k !== dedicated);
    return [
      { key: dedicated, label: "net-metering", index: 0 },
      ...fallback.map((key, i) => ({
        key,
        label: `fallback-${i + 1}`,
        index: i + 1,
      })),
    ];
  }
  return getOrderedGeminiApiKeys();
}

export { getGeminiModelCandidates };
