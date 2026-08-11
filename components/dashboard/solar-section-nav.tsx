"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  solarSectionFromPath,
  solarSections,
  type SolarSectionValue,
} from "@/lib/dashboard/solar-sections";
import { ChevronDown } from "lucide-react";

export function SolarSectionNav({
  active,
}: {
  active?: SolarSectionValue;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = active ?? solarSectionFromPath(pathname);
  const currentMeta = solarSections.find((s) => s.value === current);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[oklch(0.9_0.02_185)] bg-[oklch(0.99_0.01_185)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Solar section
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {currentMeta?.description}
        </p>
      </div>
      <label className="relative block w-full sm:w-56">
        <span className="sr-only">Choose solar section</span>
        <select
          className="h-9 w-full appearance-none rounded-lg border border-input bg-background py-2 pr-9 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={current}
          onChange={(event) => {
            const next = solarSections.find(
              (section) => section.value === event.target.value,
            );
            if (next) router.push(next.href);
          }}
        >
          {solarSections.map((section) => (
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
