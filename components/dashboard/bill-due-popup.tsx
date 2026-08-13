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

const DISMISS_KEY = "utility-bill-due-dismissed";

function dismissSignature(alerts: OpsAlert[]) {
  return alerts
    .map((a) => a.id)
    .sort()
    .join("|");
}

/** Popup when utility bills are due / overdue (session-dismissible). */
export function BillDuePopup({ alerts }: { alerts: OpsAlert[] }) {
  const utilityAlerts = useMemo(
    () =>
      alerts.filter(
        (a) =>
          a.domain === "utilities" &&
          (a.severity === "critical" || a.severity === "warning"),
      ),
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
            Utility bill{utilityAlerts.length === 1 ? "" : "s"} due
          </DialogTitle>
        </DialogHeader>
        <ul className="space-y-2.5">
          {utilityAlerts.map((alert) => (
            <li
              key={alert.id}
              className="rounded-lg border border-[oklch(0.86_0.07_85)] bg-[oklch(0.98_0.02_85)] px-3 py-2.5"
            >
              <p className="text-sm font-medium">{alert.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={dismiss}>
            Dismiss for now
          </Button>
          <Link
            href="/dashboard/utilities"
            onClick={dismiss}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            Open utilities
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
