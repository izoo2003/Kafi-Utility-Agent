/** Questions that must be answered from live site records, not chat memory. */
const RECORD_HINT =
  /\b(stock|inventory|qty|quantity|reorder|kitchen|tenant|rent|outstanding|overdue|bill|paid|due|k-?electric|ssgc|kwsb|ptcl|jazz|tanker|drinking water|generator|fuel|oil|maintenance|expense|debit|solar|sems|warranty|alert|status|summary|update|overview|anything|everything|site|ops|how many|what(?:'s| is)|list|show|latest|last|current|log|logs|tell me|about)\b/i;

const SMALL_TALK =
  /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|yo|good morning|good evening)\b/i;

export function shouldRequireLiveLookup(
  userText: string,
  hasAttachments: boolean,
): boolean {
  if (hasAttachments) return true;
  const t = userText.trim();
  if (t.length < 2) return false;
  if (SMALL_TALK.test(t) && t.length < 32) return false;
  // Brief/vague ops questions still need a live lookup (e.g. "tenants?", "status").
  return RECORD_HINT.test(t) || t.length >= 8;
}

export const GROUNDING_NUDGE =
  "GROUNDING REQUIRED: Answer from live site records. Do not ask the user to rephrase. For vague questions, call ops_alerts_list and/or the matching *_list tools now, then answer ONLY from those tool results. If empty, say records are empty. If truncated, say newest N of M.";

export function wrapToolResult(result: unknown) {
  return {
    source: "site_database",
    fetched_at: new Date().toISOString(),
    result,
  };
}

export function truncatedList<T>(
  all: T[],
  limit: number,
  extra?: Record<string, unknown>,
) {
  const records = all.slice(0, limit);
  const truncated = records.length < all.length;
  return {
    total: all.length,
    returned: records.length,
    truncated,
    note: truncated
      ? `Showing newest ${records.length} of ${all.length}. Raise limit or filter to see the rest.`
      : undefined,
    ...extra,
    records,
  };
}
