import { AlertTriangle } from "lucide-react";
import { getSolarSitesConfigError } from "@/lib/sems/sites";

export function SolarSitesConfigNotice() {
  const error = getSolarSitesConfigError();
  if (!error) return null;

  return (
    <section
      role="alert"
      className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">Solar site configuration warning</p>
          <p className="text-amber-900/90">{error}</p>
        </div>
      </div>
    </section>
  );
}
