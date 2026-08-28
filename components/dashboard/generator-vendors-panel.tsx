"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GeneratorVendor } from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { upsertById } from "@/lib/dashboard/sort";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { generatorSectionMeta } from "@/lib/dashboard/generator-sections";
import { PageHeader } from "@/components/dashboard/page-header";
import { GeneratorSectionNav } from "@/components/dashboard/generator-section-nav";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ImportFilesButton } from "@/components/dashboard/import-files-button";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { TablePagination } from "@/components/dashboard/table-pagination";
import {
  CellPrimary,
  CellText,
  TableActions,
  TableShell,
} from "@/components/dashboard/table-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type VendorForm = {
  name: string;
  phone: string;
  notes: string;
};

const emptyForm = (): VendorForm => ({
  name: "",
  phone: "",
  notes: "",
});

function toForm(item: GeneratorVendor): VendorForm {
  return {
    name: item.name,
    phone: item.phone ?? "",
    notes: item.notes ?? "",
  };
}

export function GeneratorVendorsPanel({
  initialVendors,
}: {
  initialVendors: GeneratorVendor[];
}) {
  const router = useRouter();
  const copy = generatorSectionMeta("vendors");
  const [vendors, setVendors] = useState(initialVendors);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GeneratorVendor | null>(null);
  const [form, setForm] = useState<VendorForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () =>
      [...vendors].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [vendors],
  );
  const pageState = usePagedRows(sorted);

  async function save() {
    if (!form.name.trim()) {
      setError("Vendor name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const data = await apiFetch<GeneratorVendor>(
          `/api/generator/vendors/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setVendors((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<GeneratorVendor>("/api/generator/vendors", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setVendors((prev) => upsertById(prev, data));
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
      <PageHeader
        title={`Generator · ${copy.label}`}
        description={copy.pageDescription}
        icon="generator"
        accent="orange"
      />
      <GeneratorSectionNav active="vendors" />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">Vendors</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons resource="generator-vendors" />
            <ImportFilesButton target="generator-vendors" />
            <Button
              onClick={() => {
                setEditing(null);
                setForm(emptyForm());
                setError(null);
                setOpen(true);
              }}
            >
              Add vendor
            </Button>
          </div>
        </div>

        {error && !open ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Name</TableHead>
                <TableHead className="w-[22%]">Phone</TableHead>
                <TableHead className="w-[30%]">Notes</TableHead>
                <TableHead className="w-[20%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No vendors yet.
                  </TableCell>
                </TableRow>
              ) : (
                pageState.pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <CellPrimary title={row.name} />
                    </TableCell>
                    <TableCell>
                      <CellText>{row.phone ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.notes ?? "—"}</CellText>
                    </TableCell>
                    <TableCell className="max-w-none">
                      <TableActions>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing(row);
                            setForm(toForm(row));
                            setError(null);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={async () => {
                            await apiFetch(`/api/generator/vendors/${row.id}`, {
                              method: "DELETE",
                            });
                            setVendors((prev) =>
                              prev.filter((i) => i.id !== row.id),
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
        <TablePagination
          total={pageState.total}
          page={pageState.page}
          onPageChange={pageState.setPage}
        />
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit vendor" : "Add vendor"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
                rows={3}
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
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
