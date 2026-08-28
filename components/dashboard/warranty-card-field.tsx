"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fileNameFromStoragePath } from "@/lib/supabase/warranty-storage";

export function WarrantyCardField({
  existingPath,
  onFileChange,
  onView,
}: {
  existingPath: string | null;
  onFileChange: (file: File | null) => void;
  onView?: () => void;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor="warranty_card">Warranty card photo</Label>
      {existingPath ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 truncate text-muted-foreground">
            Current: {fileNameFromStoragePath(existingPath)}
          </span>
          {onView ? (
            <Button type="button" variant="outline" size="sm" onClick={onView}>
              View card
            </Button>
          ) : null}
        </div>
      ) : null}
      <Input
        id="warranty_card"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
