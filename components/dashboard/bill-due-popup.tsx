"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";
import type { OpsAlert } from "@/lib/alerts/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DISMISS_KEY = "ops-due-alerts-dismissed";

function dismissSignature(alerts: OpsAlert[]) {
  return alerts
    .map((a) => a.id)
    .sort()
    .join("|");
}

function isPopupAlert(a: OpsAlert) {
  if (!(a.severity === "critical" || a.severity === "warning")) return false;
  if (a.domain === "utilities" || a.domain === "tenants") return true;
  return a.id.startsWith("generator-oil");
}

/** Popup for utility bills due and generator oil-change alerts (session-dismissible). */
export function BillDuePopup({ alerts }: { alerts: OpsAlert[] }) {
  const utilityAlerts = useMemo(
    () => alerts.filter(isPopupAlert),
    [alerts],
  );

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!utilityAlerts.length) {
      setOpen(false);
      return;
    }
    const sig = dismissSignature(utilityAlerts);
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === sig) {
        setOpen(false);
        return;
      }
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, [utilityAlerts]);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, dismissSignature(utilityAlerts));
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!utilityAlerts.length) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
        else setOpen(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="size-5 text-[oklch(0.5_0.14_45)]" />
            Attention needed
          </DialogTitle>
        </DialogHeader>
        <ul className="space-y-2.5">
          {utilityAlerts.map((alert) => (
            <li
              key={alert.id}
              className="rounded-lg border border-[oklch(0.86_0.07_85)] bg-[oklch(0.98_0.02_85)] px-3 py-2.5"
            >
              <Link
                href={alert.href}
                onClick={dismiss}
                className="text-sm font-medium hover:underline"
              >
                {alert.title}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={dismiss}>
            Dismiss for now
          </Button>
          <Link
            href={utilityAlerts[0]?.href ?? "/dashboard"}
            onClick={dismiss}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            Open section
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
