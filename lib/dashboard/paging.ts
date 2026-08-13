export const TABLE_PAGE_SIZE = 10;

export function pageCount(total: number, pageSize = TABLE_PAGE_SIZE): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function slicePage<T>(
  rows: T[],
  page: number,
  pageSize = TABLE_PAGE_SIZE,
): T[] {
  const safePage = Math.min(Math.max(page, 1), pageCount(rows.length, pageSize));
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
