"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function SolarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[solar]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <h2 className="font-heading text-lg font-semibold text-destructive">
        Solar section failed to load
      </h2>
      <p className="text-sm text-muted-foreground">
        This usually means the <code className="text-xs">SEMS_SITES</code>{" "}
        environment variable on Vercel is invalid JSON or missing required
        fields. Other dashboard sections are unaffected because they do not read
        that setting.
      </p>
      {error.message ? (
        <pre className="max-h-40 overflow-auto rounded-lg border bg-background p-3 text-xs whitespace-pre-wrap">
          {error.message}
        </pre>
      ) : null}
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
