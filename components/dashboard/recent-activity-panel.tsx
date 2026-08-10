import Link from "next/link";
import { Clock3, ArrowUpRight } from "lucide-react";
import type { RecentActivityItem } from "@/lib/supabase/recent-activity";
import { formatDateTime } from "@/lib/format/datetime";

const domainLabel: Record<RecentActivityItem["domain"], string> = {
  kitchen: "Kitchen",
  it: "IT",
  generator: "Generator",
  solar: "Solar",
  utilities: "Utilities",
};

export function RecentActivityPanel({
  items,
}: {
  items: RecentActivityItem[];
}) {
  return (
    <section className="space-y-3 sm:space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          Recent updates
        </h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Latest changes across domains (by last updated time).
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-[oklch(0.88_0.02_220)] bg-white/70 px-4 py-4 text-sm text-muted-foreground sm:rounded-2xl">
          No recent updates yet.
        </div>
      ) : (
        <ul className="divide-y divide-[oklch(0.92_0.015_220)] overflow-hidden rounded-xl border border-[oklch(0.88_0.02_220)] bg-white/75 sm:rounded-2xl">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-start gap-3 px-3 py-3 transition-colors hover:bg-[oklch(0.98_0.01_220)] sm:px-4 sm:py-3.5"
              >
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.95_0.02_220)] text-[oklch(0.42_0.05_220)]">
                  <Clock3 className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <span className="rounded-md bg-[oklch(0.96_0.015_220)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {domainLabel[item.domain]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTime(item.updated_at)}
                  </p>
                </div>
                <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
