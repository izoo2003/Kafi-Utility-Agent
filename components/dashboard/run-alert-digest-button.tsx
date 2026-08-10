"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RunAlertDigestButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(force: boolean) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/notifications/run${force ? "?force=1" : ""}`,
        { method: "POST" },
      );
      const json = (await res.json()) as {
        error?: string;
        data?: {
          openAlerts: number;
          dueToNotify: number;
          sent: number;
          skippedCooldown: number;
          channel: string;
        };
      };
      if (!res.ok) throw new Error(json.error ?? "Digest failed");
      const d = json.data!;
      if (d.openAlerts === 0) {
        setMessage("No open alerts — nothing to send.");
      } else if (d.sent === 0) {
        setMessage(
          `${d.openAlerts} open alert(s); all within 24h cooldown (use force to resend).`,
        );
      } else {
        setMessage(
          `Sent ${d.sent} alert(s) via ${d.channel}${d.skippedCooldown ? ` · ${d.skippedCooldown} skipped` : ""}.`,
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Digest failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void run(false)}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Mail className="size-3.5" />
          )}
          Send alert digest
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => void run(true)}
        >
          Force resend
        </Button>
      </div>
      {message ? (
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
