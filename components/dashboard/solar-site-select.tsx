"use client";

import { ChevronDown } from "lucide-react";
import type { SolarSitePublic } from "@/lib/sems/sites";
import { Label } from "@/components/ui/label";

export function SolarSiteSelect({
  sites,
  value,
  onChange,
  label = "Solar site",
}: {
  sites: SolarSitePublic[];
  value: string;
  onChange: (siteId: string) => void;
  label?: string;
}) {
  if (sites.length <= 1) return null;

  return (
    <div className="flex flex-col gap-1.5 sm:min-w-52">
      <Label htmlFor="solar-site-select">{label}</Label>
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <select
          id="solar-site-select"
          className="h-9 w-full appearance-none rounded-lg border border-input bg-background py-2 pr-9 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </label>
    </div>
  );
}
