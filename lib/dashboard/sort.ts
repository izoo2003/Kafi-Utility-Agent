/** Newest-added first (created_at descending). */
export function sortNewestFirst<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Insert or replace by id (for create endpoints that may dedupe-update). */
export function upsertById<T extends { id: string }>(rows: T[], row: T): T[] {
  const idx = rows.findIndex((r) => r.id === row.id);
  if (idx >= 0) {
    const next = [...rows];
    next[idx] = row;
    return next;
  }
  return [row, ...rows];
}
