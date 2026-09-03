"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fileNameFromStoragePath } from "@/lib/supabase/tenant-storage";

export function DocumentFileField({
  id,
  label,
  hint,
  existingPath,
  onFileChange,
  onView,
  onRemove,
  removing,
}: {
  id: string;
  label: string;
  hint?: string;
  existingPath: string | null;
  onFileChange: (file: File | null) => void;
  onView?: () => void;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={id}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {existingPath ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 truncate text-muted-foreground">
            Current: {fileNameFromStoragePath(existingPath)}
          </span>
          {onView ? (
            <Button type="button" variant="outline" size="sm" onClick={onView}>
              View
            </Button>
          ) : null}
          {onRemove ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRemove}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
          ) : null}
        </div>
      ) : null}
      <Input
        id={id}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
