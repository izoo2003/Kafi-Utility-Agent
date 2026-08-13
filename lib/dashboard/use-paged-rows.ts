"use client";

import { useEffect, useMemo, useState } from "react";
import { TABLE_PAGE_SIZE, pageCount, slicePage } from "@/lib/dashboard/paging";

export function usePagedRows<T>(rows: T[], pageSize = TABLE_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const total = rows.length;
  const pages = pageCount(total, pageSize);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const pageRows = useMemo(
    () => slicePage(rows, page, pageSize),
    [rows, page, pageSize],
  );

  return {
    page,
    setPage,
    pageRows,
    total,
    pages,
    pageSize,
  };
}
