"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  kitchenSectionFromPath,
  kitchenSections,
  type KitchenSectionValue,
} from "@/lib/dashboard/kitchen-sections";
import { ChevronDown } from "lucide-react";

export function KitchenSectionNav({
  active,
}: {
  active?: KitchenSectionValue;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = active ?? kitchenSectionFromPath(pathname);
  const currentMeta = kitchenSections.find((s) => s.value === current);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200/70 bg-amber-50/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kitchen section
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {currentMeta?.description}
        </p>
      </div>
      <label className="relative block w-full sm:w-64">
        <span className="sr-only">Choose kitchen section</span>
        <select
          className="h-9 w-full appearance-none rounded-lg border border-input bg-background py-2 pr-9 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={current}
          onChange={(event) => {
            const next = kitchenSections.find(
              (section) => section.value === event.target.value,
            );
            if (next) router.push(next.href);
          }}
        >
          {kitchenSections.map((section) => (
            <option key={section.value} value={section.value}>
              {section.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </label>
    </div>
  );
}
