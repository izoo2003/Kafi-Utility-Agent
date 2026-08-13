"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TABLE_PAGE_SIZE, pageCount } from "@/lib/dashboard/paging";

export function TablePagination({
  total,
  page,
  onPageChange,
  pageSize = TABLE_PAGE_SIZE,
}: {
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}) {
  if (total <= pageSize) return null;

  const pages = pageCount(total, pageSize);
  const safePage = Math.min(Math.max(page, 1), pages);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="gap-1"
        >
          <ChevronLeft className="size-3.5" />
          Prev
        </Button>
        <span className="min-w-[5.5rem] text-center text-xs text-muted-foreground">
          Page {safePage} / {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage >= pages}
          onClick={() => onPageChange(safePage + 1)}
          className="gap-1"
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
