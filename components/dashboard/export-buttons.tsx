import { Download, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { ExportResource } from "@/lib/export/resources";
import { cn } from "@/lib/utils";

export function ExportButtons({ resource }: { resource: ExportResource }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/export/${resource}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
      >
        <Download className="size-3.5" />
        CSV
      </a>
      <a
        href={`/dashboard/export/${resource}?print=1`}
        target="_blank"
        rel="noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
      >
        <Printer className="size-3.5" />
        PDF
      </a>
    </div>
  );
}
