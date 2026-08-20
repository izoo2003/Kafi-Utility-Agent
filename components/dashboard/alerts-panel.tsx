import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CookingPot,
  Cpu,
  Fuel,
  SunMedium,
  Wifi,
  Building2,
} from "lucide-react";
import type { OpsAlert } from "@/lib/alerts/types";
import { RunAlertDigestButton } from "@/components/dashboard/run-alert-digest-button";
import { cn } from "@/lib/utils";

const domainMeta = {
  kitchen: {
    label: "Kitchen",
    icon: CookingPot,
    chip: "bg-[oklch(0.94_0.05_85)] text-[oklch(0.45_0.12_60)]",
  },
  it: {
    label: "IT",
    icon: Cpu,
    chip: "bg-[oklch(0.93_0.04_230)] text-[oklch(0.42_0.1_240)]",
  },
  generator: {
    label: "Generator",
    icon: Fuel,
    chip: "bg-[oklch(0.94_0.05_55)] text-[oklch(0.48_0.14_45)]",
  },
  solar: {
    label: "Solar",
    icon: SunMedium,
    chip: "bg-[oklch(0.93_0.05_185)] text-[oklch(0.4_0.1_185)]",
  },
  utilities: {
    label: "Utilities",
    icon: Wifi,
    chip: "bg-[oklch(0.94_0.04_250)] text-[oklch(0.42_0.1_250)]",
  },
  tenants: {
    label: "Tenants",
    icon: Building2,
    chip: "bg-[oklch(0.94_0.04_290)] text-[oklch(0.42_0.12_290)]",
  },
} as const;

function severityStyles(severity: OpsAlert["severity"]) {
  if (severity === "critical") {
    return "border-[oklch(0.82_0.08_25)] bg-[oklch(0.97_0.02_25)]";
  }
  if (severity === "warning") {
    return "border-[oklch(0.86_0.07_85)] bg-[oklch(0.98_0.02_85)]";
  }
  return "border-[oklch(0.88_0.02_220)] bg-white/70";
}

export function AlertsPanel({ alerts }: { alerts: OpsAlert[] }) {
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            Alerts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Derived from inventory, warranties, generator service / oil change
            (200 h of logged outage runs), solar flags, utility bills, and
            tenant rent / electricity dues.
            Digests can email once per alert per 24 hours.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end sm:text-sm">
            <span className="rounded-md bg-[oklch(0.95_0.03_25)] px-2.5 py-1 font-medium text-[oklch(0.45_0.14_25)]">
              {criticalCount} critical
            </span>
            <span className="rounded-md bg-[oklch(0.95_0.04_85)] px-2.5 py-1 font-medium text-[oklch(0.45_0.12_70)]">
              {warningCount} warning
            </span>
          </div>
          <RunAlertDigestButton />
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-[oklch(0.86_0.04_155)] bg-[oklch(0.97_0.02_155)] px-4 py-4 sm:rounded-2xl sm:px-5 sm:py-5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[oklch(0.45_0.1_155)]" />
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold text-[oklch(0.32_0.05_155)] sm:text-lg">
              All clear
            </p>
            <p className="mt-1 text-sm text-[oklch(0.42_0.04_155)]">
              No low stock, warranty, generator service, solar, utility bill,
              or tenant rent / electricity alerts right now.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5 sm:space-y-3">
          {alerts.map((alert) => {
            const meta = domainMeta[alert.domain];
            const Icon = meta.icon;
            return (
              <li key={alert.id}>
                <Link
                  href={alert.href}
                  className={cn(
                    "group flex items-start gap-2.5 rounded-xl border px-3 py-3 transition-all duration-200 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-4 sm:hover:-translate-y-0.5 sm:hover:shadow-[0_10px_30px_-18px_oklch(0.4_0.08_195)]",
                    severityStyles(alert.severity),
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10",
                      meta.chip,
                    )}
                  >
                    <Icon className="size-4 sm:size-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <p className="font-heading text-sm font-semibold tracking-tight sm:text-base">
                        {alert.title}
                      </p>
                      <span className="rounded-md bg-white/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                        {meta.label}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-xs",
                          alert.severity === "critical"
                            ? "bg-[oklch(0.93_0.05_25)] text-[oklch(0.45_0.16_25)]"
                            : "bg-[oklch(0.94_0.05_85)] text-[oklch(0.45_0.12_70)]",
                        )}
                      >
                        <AlertTriangle className="size-3" />
                        {alert.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {alert.detail}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 hidden size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary sm:block" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
