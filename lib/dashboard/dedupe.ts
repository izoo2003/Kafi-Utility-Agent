/**
 * Duplicate handling for creates across all domains:
 * - No match → insert
 * - Match and incoming is more recent (or same date) → update existing
 * - Match and existing is newer → skip (keep existing, no extra row)
 */

export type DedupeOutcome = "created" | "updated" | "skipped";

export function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Compare YYYY-MM-DD; nulls sort as oldest. */
export function compareIsoDates(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const aa = a?.trim() || "";
  const bb = b?.trim() || "";
  if (!aa && !bb) return 0;
  if (!aa) return -1;
  if (!bb) return 1;
  return aa.localeCompare(bb);
}

/**
 * Incoming wins when its business date is >= existing date.
 * When both dates missing/equal, prefer incoming (refresh) unless existing
 * updated_at is clearly newer than incomingUpdatedAt (usually "now").
 */
export function incomingShouldOverwrite(opts: {
  incomingDate?: string | null;
  existingDate?: string | null;
  existingUpdatedAt?: string | null;
  incomingUpdatedAt?: string | null;
}): boolean {
  const dateCmp = compareIsoDates(opts.incomingDate, opts.existingDate);
  if (dateCmp > 0) return true;
  if (dateCmp < 0) return false;

  const incomingTs = opts.incomingUpdatedAt
    ? Date.parse(opts.incomingUpdatedAt)
    : Date.now();
  const existingTs = opts.existingUpdatedAt
    ? Date.parse(opts.existingUpdatedAt)
    : 0;
  if (!Number.isFinite(existingTs)) return true;
  if (!Number.isFinite(incomingTs)) return false;
  // Same business date: overwrite unless existing was updated after "now" (clock skew)
  return incomingTs >= existingTs;
}

export function outcomeSummary(
  outcome: DedupeOutcome,
  label: string,
): string {
  if (outcome === "created") return `Created ${label}.`;
  if (outcome === "updated")
    return `Updated existing ${label} (duplicate replaced with more recent data).`;
  return `Skipped duplicate ${label} (existing record is more recent).`;
}
