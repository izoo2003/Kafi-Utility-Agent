"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canUseHistoryBack,
  dashboardParentPath,
} from "@/lib/dashboard/back-path";
import { cn } from "@/lib/utils";

export function DashboardBackButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || pathname === "/dashboard") return null;

  function goBack() {
    if (canUseHistoryBack(pathname)) {
      router.back();
      return;
    }
    router.push(dashboardParentPath(pathname));
  }

  return (
    <div className={cn(compact ? "shrink-0" : null, className)}>
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon-sm" : "sm"}
        onClick={goBack}
        aria-label="Go back"
        className={
          compact
            ? "text-[oklch(0.38_0.03_230)]"
            : "-ml-1.5 text-[oklch(0.4_0.03_230)] hover:text-[oklch(0.26_0.04_230)]"
        }
      >
        <ArrowLeft />
        {compact ? <span className="sr-only">Back</span> : "Back"}
      </Button>
    </div>
  );
}
