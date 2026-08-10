"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { KitchenInventory } from "@/lib/types/database";
import { kitchenInventoryStatus } from "@/lib/supabase/kitchen-inventory";
import { apiFetch } from "@/lib/dashboard/api-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButtons } from "@/components/dashboard/export-buttons";
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
  item_name: string;
  category: string;
  unit: string;
  current_qty: string;
  reorder_level: string;
  reorder_qty: string;
  supplier: string;
  cost_per_unit: string;
  last_restocked_at: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  item_name: "",
  category: "",
  unit: "",
  current_qty: "0",
  reorder_level: "0",
  reorder_qty: "",
  supplier: "",
  cost_per_unit: "",
  last_restocked_at: "",
  notes: "",
});

function toForm(item: KitchenInventory): FormState {
  return {
    item_name: item.item_name,
    category: item.category ?? "",
    unit: item.unit ?? "",
    current_qty: String(item.current_qty ?? 0),
    reorder_level: String(item.reorder_level ?? 0),
    reorder_qty: item.reorder_qty == null ? "" : String(item.reorder_qty),
    supplier: item.supplier ?? "",
    cost_per_unit:
      item.cost_per_unit == null ? "" : String(item.cost_per_unit),
    last_restocked_at: item.last_restocked_at ?? "",
    notes: item.notes ?? "",
  };
}

function toPayload(form: FormState) {
  return {
    item_name: form.item_name,
    category: form.category,
    unit: form.unit,
    current_qty: form.current_qty === "" ? 0 : Number(form.current_qty),
    reorder_level: form.reorder_level === "" ? 0 : Number(form.reorder_level),
    reorder_qty: form.reorder_qty === "" ? null : Number(form.reorder_qty),
    supplier: form.supplier,
    cost_per_unit:
      form.cost_per_unit === "" ? null : Number(form.cost_per_unit),
    last_restocked_at: form.last_restocked_at || null,
    notes: form.notes,
  };
}

export function KitchenInventoryPanel({
  initialItems,
}: {
  initialItems: KitchenInventory[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KitchenInventory | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => a.item_name.localeCompare(b.item_name)),
    [items],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(item: KitchenInventory) {
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
        const data = await apiFetch<KitchenInventory>(
          `/api/kitchen-inventory/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<KitchenInventory>(
          "/api/kitchen-inventory",
          { method: "POST", body: JSON.stringify(payload) },
        );
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
    await apiFetch(`/api/kitchen-inventory/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  }

  function field<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Kitchen inventory"
          description="Track stock levels and reorder thresholds."
          icon="kitchen"
          accent="amber"
        />
        <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
          <ExportButtons resource="kitchen-inventory" />
          <Button onClick={openCreate}>Add item</Button>
        </div>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[24%]">Item</TableHead>
              <TableHead className="w-[10%]">Qty</TableHead>
              <TableHead className="w-[10%]">Reorder</TableHead>
              <TableHead className="w-[10%]">Status</TableHead>
              <TableHead className="w-[14%]">Supplier</TableHead>
              <TableHead className="w-[14%]">Updated</TableHead>
              <TableHead className="w-[18%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="max-w-none py-8 text-center text-muted-foreground"
                >
                  No items yet. Add your first kitchen inventory item.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((item) => {
                const status = kitchenInventoryStatus(item);
                const qtyLabel = `${item.current_qty}${item.unit ? ` ${item.unit}` : ""}`;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <CellPrimary
                        title={item.item_name}
                        subtitle={[item.category, item.unit]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                    </TableCell>
                    <TableCell>
                      <CellText>{qtyLabel}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{item.reorder_level}</CellText>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={status === "low" ? "destructive" : "secondary"}
                      >
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <CellText>{item.supplier ?? "—"}</CellText>
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
                          title={`Delete ${item.item_name}?`}
                        />
                      </TableActions>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit item" : "Add kitchen item"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto py-1 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="item_name">Item name</Label>
              <Input
                id="item_name"
                value={form.item_name}
                onChange={(e) => field("item_name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => field("category", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="kg, litre, pack…"
                value={form.unit}
                onChange={(e) => field("unit", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_qty">Current qty</Label>
              <Input
                id="current_qty"
                type="number"
                min="0"
                step="any"
                value={form.current_qty}
                onChange={(e) => field("current_qty", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorder_level">Reorder level</Label>
              <Input
                id="reorder_level"
                type="number"
                min="0"
                step="any"
                value={form.reorder_level}
                onChange={(e) => field("reorder_level", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorder_qty">Reorder qty</Label>
              <Input
                id="reorder_qty"
                type="number"
                min="0"
                step="any"
                value={form.reorder_qty}
                onChange={(e) => field("reorder_qty", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost_per_unit">Cost per unit</Label>
              <Input
                id="cost_per_unit"
                type="number"
                min="0"
                step="any"
                value={form.cost_per_unit}
                onChange={(e) => field("cost_per_unit", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={form.supplier}
                onChange={(e) => field("supplier", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_restocked_at">Last restocked</Label>
              <Input
                id="last_restocked_at"
                type="date"
                value={form.last_restocked_at}
                onChange={(e) => field("last_restocked_at", e.target.value)}
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
            <Button onClick={save} disabled={saving || !form.item_name.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
