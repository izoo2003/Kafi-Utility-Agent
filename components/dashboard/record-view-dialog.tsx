"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type RecordViewField = {
  label: string;
  value: React.ReactNode;
};

export function RecordViewDialog({
  open,
  onOpenChange,
  title,
  fields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: RecordViewField[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <dl className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.label}
              className="rounded-lg border border-[oklch(0.9_0.02_220)] px-3 py-2.5"
            >
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="mt-1 break-words text-sm font-medium">
                {field.value == null || field.value === "" ? "—" : field.value}
              </dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
