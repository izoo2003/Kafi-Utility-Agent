"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WithholdingTaxSlab } from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { upsertById } from "@/lib/dashboard/sort";
import { formatMoney } from "@/lib/tenants/payment-status";
import { FILER_RENT_SLABS_2026_27 } from "@/lib/tenants/withholding-tax";
import { PageHeader } from "@/components/dashboard/page-header";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import {
  CellText,
  TableActions,
  TableShell,
} from "@/components/dashboard/table-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SlabForm = {
  label: string;
  min_amount: string;
  max_amount: string;
  rate_percent: string;
  notes: string;
};

const emptyForm = (): SlabForm => ({
  label: "",
  min_amount: "0",
  max_amount: "",
  rate_percent: "",
  notes: "",
});

function toForm(slab: WithholdingTaxSlab): SlabForm {
  return {
    label: slab.label ?? "",
    min_amount: String(slab.min_amount ?? 0),
    max_amount: slab.max_amount == null ? "" : String(slab.max_amount),
    rate_percent: String(slab.rate_percent ?? ""),
    notes: slab.notes ?? "",
  };
}

export function WithholdingTaxSlabsPanel({
  initialSlabs,
}: {
  initialSlabs: WithholdingTaxSlab[];
}) {
  const router = useRouter();
  const [slabs, setSlabs] = useState(initialSlabs);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WithholdingTaxSlab | null>(null);
  const [form, setForm] = useState<SlabForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () => [...slabs].sort((a, b) => Number(a.min_amount) - Number(b.min_amount)),
    [slabs],
  );

  async function save() {
    const rate = Number(form.rate_percent);
    if (!Number.isFinite(rate) || rate < 0) {
      setError("Rate % is required.");
      return;
    }
    const min = Number(form.min_amount || 0);
    const max = form.max_amount === "" ? null : Number(form.max_amount);
    if (max != null && max < min) {
      setError("Max amount must be ≥ min amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        label: form.label.trim() || null,
        min_amount: min,
        max_amount: max,
        rate_percent: rate,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const data = await apiFetch<WithholdingTaxSlab>(
          `/api/withholding-tax-slabs/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setSlabs((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      } else {
        const data = await apiFetch<WithholdingTaxSlab>(
          "/api/withholding-tax-slabs",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setSlabs((prev) => upsertById(prev, data));
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Withholding Tax Slabs"
          description="Filer tax on rent for 2026-27. Progressive yearly bands — unofficial tenants are never taxed."
          icon="tenants"
          accent="violet"
        />
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          <Link
            href="/dashboard/tenants"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            All tenants
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              void (async () => {
                setSaving(true);
                setError(null);
                try {
                  const data = await apiFetch<WithholdingTaxSlab[]>(
                    "/api/withholding-tax-slabs/seed-filer",
                    { method: "POST" },
                  );
                  setSlabs(data);
                  router.refresh();
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not load Filer slabs",
                  );
                } finally {
                  setSaving(false);
                }
              })();
            }}
            disabled={saving}
          >
            {saving ? "Saving…" : "Load Filer 2026-27 slabs"}
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setForm(emptyForm());
              setError(null);
              setOpen(true);
            }}
          >
            Add slab
          </Button>
        </div>
      </div>

      {error && !open ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-[oklch(0.88_0.02_220)] bg-white/70">
        <div className="border-b border-[oklch(0.9_0.02_220)] px-4 py-3">
          <h2 className="font-heading text-base font-semibold">
            Tax on rent in Pakistan for 2026-27 (Filer)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Rent is taxed in steps on the whole year. Each step only applies to
            the rent inside that bracket. The first Rs. 300,000 is always
            tax-free. Official tenants are taxed automatically from these bands;
            unofficial tenants have no withholding tax.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Yearly rent bracket</TableHead>
              <TableHead>Tax for Filer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FILER_RENT_SLABS_2026_27.map((band) => (
              <TableRow key={band.label}>
                <TableCell>
                  <CellText className="font-medium">{band.label}</CellText>
                </TableCell>
                <TableCell>
                  <CellText>
                    {band.rate_percent === 0 ? "No tax" : band.notes}
                  </CellText>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Yearly rent bracket</TableHead>
              <TableHead>From (yearly)</TableHead>
              <TableHead>To (yearly)</TableHead>
              <TableHead>Rate on this band</TableHead>
              <TableHead>How it is applied</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="max-w-none py-8 text-center text-muted-foreground"
                >
                  No slabs stored yet. Use “Load Filer 2026-27 slabs” to write
                  the official Filer bands.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((slab) => (
                <TableRow key={slab.id}>
                  <TableCell>
                    <CellText>{slab.label ?? "—"}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>{formatMoney(slab.min_amount)}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>
                      {slab.max_amount == null
                        ? "No limit"
                        : formatMoney(slab.max_amount)}
                    </CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>{slab.rate_percent}%</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>{slab.notes ?? "—"}</CellText>
                  </TableCell>
                  <TableCell className="max-w-none">
                    <TableActions>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(slab);
                          setForm(toForm(slab));
                          setError(null);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <ConfirmDeleteButton
                        title={`Delete slab${slab.label ? ` "${slab.label}"` : ""}?`}
                        description="Withholding tax on all official tenants will be recalculated without this slab."
                        onConfirm={async () => {
                          await apiFetch(
                            `/api/withholding-tax-slabs/${slab.id}`,
                            { method: "DELETE" },
                          );
                          setSlabs((prev) =>
                            prev.filter((s) => s.id !== slab.id),
                          );
                          router.refresh();
                        }}
                      />
                    </TableActions>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit slab" : "Add slab"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Label (optional)</Label>
              <Input
                value={form.label}
                placeholder="e.g. Standard rate"
                onChange={(e) =>
                  setForm((p) => ({ ...p, label: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Yearly rent from</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.min_amount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, min_amount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Yearly rent to (blank = no limit)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.max_amount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, max_amount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Rate % on this band</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.rate_percent}
                onChange={(e) =>
                  setForm((p) => ({ ...p, rate_percent: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                rows={3}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.rate_percent}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
