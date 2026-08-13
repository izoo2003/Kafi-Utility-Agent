"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ItEquipment, ItEquipmentStatus } from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { sortNewestFirst } from "@/lib/dashboard/sort";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ImportFilesButton } from "@/components/dashboard/import-files-button";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { formatDateTime } from "@/lib/format/datetime";
import {
  CellPrimary,
  CellText,
  TableActions,
  TableShell,
} from "@/components/dashboard/table-shell";
import { Badge } from "@/components/ui/badge";
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

type FormState = {
  asset_tag: string;
  item_name: string;
  category: string;
  assigned_to: string;
  serial_number: string;
  purchase_date: string;
  warranty_expiry: string;
  status: ItEquipmentStatus;
  location: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  asset_tag: "",
  item_name: "",
  category: "",
  assigned_to: "",
  serial_number: "",
  purchase_date: "",
  warranty_expiry: "",
  status: "active",
  location: "",
  notes: "",
});

function toForm(item: ItEquipment): FormState {
  return {
    asset_tag: item.asset_tag,
    item_name: item.item_name,
    category: item.category ?? "",
    assigned_to: item.assigned_to ?? "",
    serial_number: item.serial_number ?? "",
    purchase_date: item.purchase_date ?? "",
    warranty_expiry: item.warranty_expiry ?? "",
    status: item.status,
    location: item.location ?? "",
    notes: item.notes ?? "",
  };
}

function toPayload(form: FormState) {
  return {
    asset_tag: form.asset_tag,
    item_name: form.item_name,
    category: form.category,
    assigned_to: form.assigned_to,
    serial_number: form.serial_number,
    purchase_date: form.purchase_date || null,
    warranty_expiry: form.warranty_expiry || null,
    status: form.status,
    location: form.location,
    notes: form.notes,
  };
}

export function ItEquipmentPanel({
  initialItems,
}: {
  initialItems: ItEquipment[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItEquipment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => sortNewestFirst(items), [items]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(item: ItEquipment) {
    setEditing(item);
    setForm(toForm(item));
    setError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form);
      if (editing) {
        const data = await apiFetch<ItEquipment>(
          `/api/it-equipment/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<ItEquipment>("/api/it-equipment", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setItems((prev) => [...prev, data]);
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await apiFetch(`/api/it-equipment/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  }

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="IT equipment"
          description="Asset register for site hardware."
          icon="it"
          accent="sky"
        />
        <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
          <ExportButtons resource="it-equipment" />
          <ImportFilesButton target="it-equipment" />
          <Button onClick={openCreate}>Add asset</Button>
        </div>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[22%]">Asset</TableHead>
              <TableHead className="w-[14%]">Assigned</TableHead>
              <TableHead className="w-[12%]">Status</TableHead>
              <TableHead className="w-[12%]">Location</TableHead>
              <TableHead className="w-[12%]">Warranty</TableHead>
              <TableHead className="w-[14%]">Updated</TableHead>
              <TableHead className="w-[14%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="max-w-none py-8 text-center text-muted-foreground"
                >
                  No equipment yet. Add your first asset.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <CellPrimary
                      title={item.asset_tag}
                      subtitle={`${item.item_name}${item.category ? ` · ${item.category}` : ""}`}
                    />
                  </TableCell>
                  <TableCell>
                    <CellText>{item.assigned_to ?? "—"}</CellText>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="max-w-full truncate">
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <CellText>{item.location ?? "—"}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>{item.warranty_expiry ?? "—"}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText title={item.updated_at}>
                      {formatDateTime(item.updated_at)}
                    </CellText>
                  </TableCell>
                  <TableCell className="max-w-none">
                    <TableActions>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </Button>
                      <ConfirmDeleteButton
                        onConfirm={() => remove(item.id)}
                        title={`Delete ${item.asset_tag}?`}
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
            <DialogTitle>
              {editing ? "Edit asset" : "Add IT asset"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto py-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset_tag">Asset tag</Label>
              <Input
                id="asset_tag"
                value={form.asset_tag}
                onChange={(e) => field("asset_tag", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item_name">Item name</Label>
              <Input
                id="item_name"
                value={form.item_name}
                onChange={(e) => field("item_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="laptop, monitor…"
                value={form.category}
                onChange={(e) => field("category", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={form.status}
                onChange={(e) =>
                  field("status", e.target.value as ItEquipmentStatus)
                }
              >
                <option value="active">active</option>
                <option value="in_repair">in_repair</option>
                <option value="retired">retired</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned to</Label>
              <Input
                id="assigned_to"
                value={form.assigned_to}
                onChange={(e) => field("assigned_to", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => field("location", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial_number">Serial number</Label>
              <Input
                id="serial_number"
                value={form.serial_number}
                onChange={(e) => field("serial_number", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase_date">Purchase date</Label>
              <Input
                id="purchase_date"
                type="date"
                value={form.purchase_date}
                onChange={(e) => field("purchase_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warranty_expiry">Warranty expiry</Label>
              <Input
                id="warranty_expiry"
                type="date"
                value={form.warranty_expiry}
                onChange={(e) => field("warranty_expiry", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
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
            <Button
              onClick={save}
              disabled={
                saving || !form.asset_tag.trim() || !form.item_name.trim()
              }
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
