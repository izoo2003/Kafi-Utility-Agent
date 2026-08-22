"use client";

import { Archive } from "lucide-react";
import { solarSiteNavLabel } from "@/lib/dashboard/solar-site-nav";
import { SOLAR_SITE_STATIC_MESSAGE } from "@/lib/sems/site-static";
import { Badge } from "@/components/ui/badge";

export function SolarSiteStaticNotice({
  siteLabel,
  capturedAt,
}: {
  siteLabel?: string;
  capturedAt?: string | null;
}) {
  const name = siteLabel ? solarSiteNavLabel(siteLabel) : "This solar plant";

  return (
    <section
      role="status"
      className="rounded-xl border border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-stone-50 px-4 py-4 shadow-sm sm:px-6"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-sky-100 p-2 text-sky-800">
          <Archive className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold text-stone-900">
              {name} — static archive
            </h2>
            <Badge variant="secondary" className="bg-sky-100 text-sky-900">
              Static data
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {SOLAR_SITE_STATIC_MESSAGE}
            {capturedAt ? ` Last capture: ${capturedAt}.` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
