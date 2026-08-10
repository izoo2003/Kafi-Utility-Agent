"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { PageTransition } from "@/components/dashboard/page-transition";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardShell({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const brand = (
    <div className="border-b border-[oklch(0.9_0.02_220)] px-4 py-4 sm:px-5 sm:py-5">
      <p className="font-heading text-base font-semibold tracking-tight text-[oklch(0.28_0.05_195)] sm:text-lg">
        Facility Ops
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
        Signed in as{" "}
        <span className="font-medium text-foreground">{username}</span>
      </p>
    </div>
  );

  const sidebarBody = (
    <>
      {brand}
      <SidebarNav onNavigate={() => setMobileOpen(false)} />
      <div className="mt-auto border-t border-[oklch(0.9_0.02_220)] p-3">
        <SignOutButton />
      </div>
    </>
  );

  return (
    <div className="flex min-h-full min-h-dvh flex-1">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[oklch(0.88_0.02_220)] bg-[oklch(0.975_0.012_220_/_0.92)] backdrop-blur-md print:hidden md:flex">
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 print:hidden md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label="Close menu"
          className={cn(
            "absolute inset-0 bg-[oklch(0.2_0.02_230_/_0.45)] transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col border-r border-[oklch(0.88_0.02_220)] bg-[oklch(0.985_0.01_220)] shadow-xl transition-transform duration-200 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-[oklch(0.9_0.02_220)] px-3 py-3">
            <p className="font-heading text-sm font-semibold text-[oklch(0.28_0.05_195)]">
              Menu
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="px-4 py-3 text-xs text-muted-foreground">
              Signed in as{" "}
              <span className="font-medium text-foreground">{username}</span>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
            <div className="mt-auto border-t border-[oklch(0.9_0.02_220)] p-3">
              <SignOutButton />
            </div>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-[oklch(0.9_0.02_220)] bg-[oklch(0.985_0.01_220_/_0.92)] px-3 py-3 backdrop-blur-md print:hidden md:hidden">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <div className="min-w-0">
            <p className="font-heading truncate text-sm font-semibold text-[oklch(0.28_0.05_195)]">
              Facility Ops
            </p>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-5 print:p-0 sm:px-6 sm:py-7 lg:px-10 lg:py-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
