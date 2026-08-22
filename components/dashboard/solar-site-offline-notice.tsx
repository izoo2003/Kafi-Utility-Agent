import { WifiOff } from "lucide-react";
import { solarSiteNavLabel } from "@/lib/dashboard/solar-site-nav";
import { SOLAR_SITE_OFFLINE_MESSAGE } from "@/lib/sems/site-offline";
import { Badge } from "@/components/ui/badge";

export function SolarSiteOfflineNotice({ siteLabel }: { siteLabel?: string }) {
  const name = siteLabel ? solarSiteNavLabel(siteLabel) : "This solar plant";

  return (
    <section
      role="alert"
      className="rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-stone-50 px-4 py-6 shadow-sm sm:px-6"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
          <WifiOff className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-lg font-semibold text-stone-900">
              {name} is offline
            </h2>
            <Badge variant="secondary" className="bg-amber-100 text-amber-900">
              Offline
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {SOLAR_SITE_OFFLINE_MESSAGE}
          </p>
        </div>
      </div>
    </section>
  );
}
