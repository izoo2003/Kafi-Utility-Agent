"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintReportActions({
  title,
  autoPrint,
}: {
  title: string;
  autoPrint?: boolean;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [autoPrint]);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Use your browser print dialog → Save as PDF.
        </p>
      </div>
      <Button type="button" onClick={() => window.print()} className="gap-1.5">
        <Printer className="size-4" />
        Print / Save PDF
      </Button>
    </div>
  );
}
