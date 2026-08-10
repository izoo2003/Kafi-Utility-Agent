/** Built-in Gemini model fallback order (first available wins). */
export const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
] as const;

/**
 * Resolve model preference list:
 * 1. GEMINI_MODEL (preferred)
 * 2. GEMINI_FALLBACK_MODELS (comma-separated)
 * 3. Built-in defaults
 * Deduped, order preserved.
 */
export function getGeminiModelCandidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const fromEnv =
    process.env.GEMINI_FALLBACK_MODELS?.split(",")
      .map((m) => m.trim())
      .filter(Boolean) ?? [];

  const ordered = [
    ...(preferred ? [preferred] : []),
    ...fromEnv,
    ...DEFAULT_GEMINI_MODELS,
  ];

  return [...new Set(ordered)];
}

/** Primary + secondary Gemini API keys (deduped). */
export function getGeminiApiKeys(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_SECONDARY,
  ]
    .map((k) => k?.trim())
    .filter((k): k is string => Boolean(k));

  return [...new Set(keys)];
}

/** Sticky preferred key index — rotates when a key is exhausted. */
let preferredKeyIndex = 0;

export function getOrderedGeminiApiKeys(): Array<{
  key: string;
  label: string;
  index: number;
}> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) return [];

  const start =
    ((preferredKeyIndex % keys.length) + keys.length) % keys.length;
  const ordered: Array<{ key: string; label: string; index: number }> = [];

  for (let i = 0; i < keys.length; i++) {
    const index = (start + i) % keys.length;
    ordered.push({
      key: keys[index],
      label: index === 0 ? "primary" : `secondary-${index}`,
      index,
    });
  }
  return ordered;
}

export function markGeminiKeySuccess(index: number) {
  preferredKeyIndex = index;
}

/** After all models fail on a key (esp. quota), prefer the next key next time. */
export function markGeminiKeyExhausted(index: number) {
  const keys = getGeminiApiKeys();
  if (keys.length <= 1) return;
  preferredKeyIndex = (index + 1) % keys.length;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : JSON.stringify(error);
}

/** Errors where trying the next model is worthwhile. */
export function isRetryableGeminiModelError(error: unknown): boolean {
  const lower = errorMessage(error).toLowerCase();

  return (
    lower.includes("404") ||
    lower.includes("not found") ||
    lower.includes("not supported") ||
    lower.includes("is not available") ||
    lower.includes("no longer available") ||
    lower.includes("model_not_found") ||
    lower.includes("429") ||
    lower.includes("resource exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("503") ||
    lower.includes("unavailable") ||
    lower.includes("overloaded") ||
    lower.includes("capacity") ||
    lower.includes("403") ||
    lower.includes("permission_denied") ||
    lower.includes("api key")
  );
}

/** Key-level exhaustion — rotate to the other API key. */
export function isGeminiKeyExhaustedError(error: unknown): boolean {
  const lower = errorMessage(error).toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("resource exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("insufficient_quota") ||
    lower.includes("billing") ||
    (lower.includes("403") && lower.includes("key"))
  );
}
