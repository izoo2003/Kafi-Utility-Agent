"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  solarSectionFromPath,
  solarSections,
  type SolarSectionValue,
} from "@/lib/dashboard/solar-sections";
import {
  hrefWithSolarSite,
  resolveSolarSiteId,
  solarSiteNavLabel,
} from "@/lib/dashboard/solar-site-nav";
import { apiFetch } from "@/lib/dashboard/api-client";
import type { SolarSitePublic } from "@/lib/sems/sites";
import { ChevronDown } from "lucide-react";

function NavSelect({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <label className={`relative block ${className ?? ""}`}>
      <span className="sr-only">{label}</span>
      <select
        id={id}
        aria-label={label}
        className="h-9 w-full appearance-none rounded-lg border border-input bg-background py-2 pr-9 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </label>
  );
}

export function SolarSectionNav({
  active,
  sites = [],
}: {
  active?: SolarSectionValue;
  sites?: SolarSitePublic[];
}) {
  return (
    <Suspense
      fallback={
        <div className="h-[4.25rem] animate-pulse rounded-xl border border-[oklch(0.9_0.02_185)] bg-[oklch(0.99_0.01_185)]" />
      }
    >
      <SolarSectionNavInner active={active} sites={sites} />
    </Suspense>
  );
}

function SolarSectionNavInner({
  active,
  sites = [],
}: {
  active?: SolarSectionValue;
  sites?: SolarSitePublic[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [plantSites, setPlantSites] = useState<SolarSitePublic[]>(sites);

  useEffect(() => {
    setPlantSites(sites);
  }, [sites]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ sites: SolarSitePublic[] }>(
          "/api/solar/sites",
        );
        if (!cancelled && data.sites.length > 0) {
          setPlantSites(data.sites);
        }
      } catch {
        /* keep server-passed sites */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = active ?? solarSectionFromPath(pathname);
  const currentMeta = solarSections.find((s) => s.value === current);
  const defaultSite = plantSites[0]?.id ?? "";
  const siteId = resolveSolarSiteId(searchParams.get("site"), plantSites, defaultSite);

  function onSiteChange(nextSiteId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("site", nextSiteId);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[oklch(0.9_0.02_185)] bg-[oklch(0.99_0.01_185)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Solar section
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {currentMeta?.description}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        {plantSites.length > 1 ? (
          <NavSelect
            id="solar-plant-select"
            label="Solar plant"
            value={siteId}
            onChange={onSiteChange}
            options={plantSites.map((site) => ({
              value: site.id,
              label: solarSiteNavLabel(site.label),
            }))}
            className="w-full sm:w-52"
          />
        ) : null}
        <NavSelect
          id="solar-section-select"
          label="Solar section"
          value={current}
          onChange={(value) => {
            const next = solarSections.find((section) => section.value === value);
            if (next) router.push(hrefWithSolarSite(next.href, siteId));
          }}
          options={solarSections.map((section) => ({
            value: section.value,
            label: section.label,
          }))}
          className="w-full sm:w-52"
        />
      </div>
    </div>
  );
}
