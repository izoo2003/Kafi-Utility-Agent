"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav } from "@/lib/dashboard/nav";
import { NavIcon } from "@/components/dashboard/nav-icon";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 p-2 sm:gap-1.5 sm:p-3">
      {dashboardNav.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out sm:text-[0.95rem]",
              active
                ? "bg-[oklch(0.96_0.02_195)] text-[oklch(0.32_0.06_195)] shadow-[inset_3px_0_0_0_oklch(0.55_0.1_195)]"
                : "text-[oklch(0.4_0.02_230)] hover:translate-x-0.5 hover:bg-white/70 hover:text-[oklch(0.28_0.04_230)]",
            )}
          >
            <NavIcon
              name={item.icon}
              accent={item.accent}
              size="sm"
              className={cn(
                "transition-transform duration-200",
                active ? "scale-105" : "group-hover:scale-105",
              )}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
