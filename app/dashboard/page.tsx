import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { collectOpsAlerts } from "@/lib/alerts/collect";
import { collectRecentActivity } from "@/lib/supabase/recent-activity";
import { dashboardNav } from "@/lib/dashboard/nav";
import { PageHeader } from "@/components/dashboard/page-header";
import { NavIcon } from "@/components/dashboard/nav-icon";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { BillDuePopup } from "@/components/dashboard/bill-due-popup";
import { RecentActivityPanel } from "@/components/dashboard/recent-activity-panel";

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const [alerts, recent] = await Promise.all([
    collectOpsAlerts(supabase),
    collectRecentActivity(supabase, 12),
  ]);
  const domains = dashboardNav.filter((item) => item.href !== "/dashboard");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 sm:space-y-10">
      <PageHeader
        title="Site operations"
        description="Live alerts, recent updates, domain shortcuts, and chat over the same data."
      />

      <BillDuePopup alerts={alerts} />
      <AlertsPanel alerts={alerts} />

      <RecentActivityPanel items={recent} />

      <section className="space-y-3 sm:space-y-4">
        <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          Domains
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {domains.map((domain) => (
            <Link
              key={domain.href}
              href={domain.href}
              className="group relative flex items-start gap-3 rounded-xl border border-[oklch(0.88_0.02_220)] bg-white/70 p-4 shadow-[0_1px_0_oklch(0.9_0.02_220)] backdrop-blur-sm transition-all duration-200 ease-out sm:gap-4 sm:rounded-2xl sm:p-5 sm:hover:-translate-y-0.5 sm:hover:border-[oklch(0.75_0.05_195)] sm:hover:bg-white sm:hover:shadow-[0_10px_30px_-18px_oklch(0.4_0.08_195)]"
            >
              <NavIcon
                name={domain.icon}
                accent={domain.accent}
                size="md"
                className="sm:hidden"
              />
              <NavIcon
                name={domain.icon}
                accent={domain.accent}
                size="lg"
                className="hidden sm:inline-flex"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
                    {domain.label}
                  </h3>
                  <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-[0.95rem]">
                  {domain.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
