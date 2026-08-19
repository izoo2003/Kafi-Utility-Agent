"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { KitchenInventory } from "@/lib/types/database";
import { kitchenReorderNotice } from "@/lib/kitchen/reorder-statement";
import type { MonthlyConsumptionReport } from "@/lib/kitchen/monthly-consumption";
import type { KitchenEdaAnalytics } from "@/lib/kitchen/eda-analytics";
import { apiFetch } from "@/lib/dashboard/api-client";
import { sortNewestFirst, upsertById } from "@/lib/dashboard/sort";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { PageHeader } from "@/components/dashboard/page-header";
import { KitchenEdaCharts } from "@/components/dashboard/kitchen-eda-charts";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ImportFilesButton } from "@/components/dashboard/import-files-button";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import {
  CellPrimary,
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

type MovementState = {
  item: KitchenInventory;
  direction: "in" | "out";
  qty: string;
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

function toPayload(form: FormState, editing: boolean) {
  const opening = form.current_qty === "" ? 0 : Number(form.current_qty);
  const base = {
    item_name: form.item_name,
    category: form.category,
    unit: form.unit,
    reorder_level: form.reorder_level === "" ? 0 : Number(form.reorder_level),
    reorder_qty: form.reorder_qty === "" ? null : Number(form.reorder_qty),
    supplier: form.supplier,
    cost_per_unit:
      form.cost_per_unit === "" ? null : Number(form.cost_per_unit),
    last_restocked_at: form.last_restocked_at || null,
    notes: form.notes,
  };
  if (editing) return base;
  return { ...base, current_qty: opening };
}

function fmtQty(n: number | null | undefined, unit?: string | null) {
  const v = Number(n) || 0;
  const num = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
  return unit ? `${num} ${unit}` : num;
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
  const [movement, setMovement] = useState<MovementState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [month, setMonth] = useState(currentMonthValue);
  const [report, setReport] = useState<MonthlyConsumptionReport | null>(null);
  const [eda, setEda] = useState<KitchenEdaAnalytics | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);

  const sorted = useMemo(() => sortNewestFirst(items), [items]);
  const { page, setPage, pageRows, total } = usePagedRows(sorted, 12);

  const loadMonthly = useCallback(async () => {
    setMonthLoading(true);
    setMonthError(null);
    try {
      const data = await apiFetch<{
        eda: KitchenEdaAnalytics;
        report: MonthlyConsumptionReport;
      }>(`/api/kitchen-inventory/monthly?month=${encodeURIComponent(month)}`);
      setEda(data.eda);
      setReport(data.report);
    } catch (e) {
      setMonthError(e instanceof Error ? e.message : "Failed to load month");
      setReport(null);
      setEda(null);
    } finally {
      setMonthLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadMonthly();
  }, [loadMonthly]);

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

  function openMovement(item: KitchenInventory, direction: "in" | "out") {
    setMovement({ item, direction, qty: "", notes: "" });
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form, Boolean(editing));
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
        setItems((prev) => upsertById(prev, data));
      }
      setOpen(false);
      router.refresh();
      void loadMonthly();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveMovement() {
    if (!movement) return;
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<KitchenInventory>(
        `/api/kitchen-inventory/${movement.item.id}/movement`,
        {
          method: "POST",
          body: JSON.stringify({
            direction: movement.direction,
            qty: Number(movement.qty),
            notes: movement.notes || null,
          }),
        },
      );
      setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      setMovement(null);
      router.refresh();
      void loadMonthly();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Movement failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await apiFetch(`/api/kitchen-inventory/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
    void loadMonthly();
  }

  async function generateAiSummary() {
    setAiLoading(true);
    setMonthError(null);
    try {
      const data = await apiFetch<{
        eda: KitchenEdaAnalytics;
        report: MonthlyConsumptionReport;
        ai: { summary: string };
      }>("/api/kitchen-inventory/monthly", {
        method: "POST",
        body: JSON.stringify({ month }),
      });
      setEda(data.eda);
      setReport(data.report);
      setAiSummary(data.ai.summary);
    } catch (e) {
      setMonthError(
        e instanceof Error ? e.message : "AI summary failed",
      );
    } finally {
      setAiLoading(false);
    }
  }

  function field<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Kitchen inventory"
          description="Stock = In − Out. Record receipts as In and finished/consumed items as Out. Monthly consumption uses Out totals."
          icon="kitchen"
          accent="amber"
        />
        <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
          <ExportButtons resource="kitchen-inventory" />
          <ImportFilesButton target="kitchen-inventory" />
          <Button onClick={openCreate}>Add item</Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-stone-50 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-amber-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-heading text-base font-semibold text-stone-900">
              Consumption analytics (EDA)
            </h2>
            <p className="text-xs text-muted-foreground">
              Charts + alerts from In/Out history. AI writes findings, risks, and
              actions from the same data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="month"
              className="h-9 w-[10.5rem] bg-white"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setAiSummary(null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadMonthly()}
              disabled={monthLoading}
            >
              {monthLoading ? "Loading…" : "Refresh"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void generateAiSummary()}
              disabled={aiLoading || monthLoading}
            >
              {aiLoading ? "Analyzing…" : "AI EDA insights"}
            </Button>
          </div>
        </div>

        {monthError ? (
          <p className="px-4 py-2 text-sm text-destructive" role="alert">
            {monthError}
          </p>
        ) : null}

        {report ? (
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-5">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70">
                In this month
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">
                {report.totals.qty_in_sum}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-rose-800/70">
                Out this month
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-900">
                {report.totals.qty_out_sum}
              </p>
              <p className="mt-1 text-xs text-rose-800/70">
                {report.totals.items_with_out} item
                {report.totals.items_with_out === 1 ? "" : "s"} consumed
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white/80 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                Est. Out cost
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
                {report.totals.estimated_out_cost_sum == null
                  ? "—"
                  : report.totals.estimated_out_cost_sum.toLocaleString()}
              </p>
            </div>
          </div>
        ) : null}

        {eda ? (
          <div className="border-t border-amber-100 px-3 py-4 sm:px-5">
            <KitchenEdaCharts data={eda} />
          </div>
        ) : monthLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
            Building charts…
          </p>
        ) : null}

        {aiSummary ? (
          <div className="border-t border-amber-100 bg-white/80 px-4 py-4 sm:px-5">
            <h3 className="text-sm font-semibold text-stone-900">
              AI exploratory insights
            </h3>
            <div className="prose prose-sm mt-2 max-w-none whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
              {aiSummary}
            </div>
          </div>
        ) : (
          <p className="border-t border-amber-100 px-4 py-3 text-xs text-muted-foreground sm:px-5">
            Charts load automatically. Click{" "}
            <span className="font-medium">AI EDA insights</span> for findings,
            alerts, trends, and next actions (uses your Gemini key).
          </p>
        )}

        {report && report.lines.some((l) => l.qty_out_month > 0) ? (
          <div className="overflow-x-auto border-t border-amber-100">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-stone-50/90 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2 font-medium sm:px-5">Item</th>
                  <th className="px-3 py-2 font-medium">In</th>
                  <th className="px-3 py-2 font-medium">Out</th>
                  <th className="px-3 py-2 font-medium">Stock now</th>
                  <th className="px-4 py-2 font-medium sm:px-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.lines
                  .filter((l) => l.qty_out_month > 0 || l.qty_in_month > 0)
                  .slice(0, 12)
                  .map((line) => (
                    <tr
                      key={line.kitchen_item_id}
                      className="border-t border-stone-100"
                    >
                      <td className="px-4 py-2.5 sm:px-5">
                        <span className="font-medium text-stone-900">
                          {line.item_name}
                        </span>
                        {line.unit ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({line.unit})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-emerald-700">
                        {line.qty_in_month}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-rose-700">
                        {line.qty_out_month}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-medium">
                        {line.stock_now}
                      </td>
                      <td className="px-4 py-2.5 sm:px-5">
                        <Badge
                          variant={
                            line.status === "ok" ? "secondary" : "destructive"
                          }
                        >
                          {line.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">Stock ledger</h2>
            <p className="text-xs text-muted-foreground">
              Green = In (received) · Rose = Out (consumed) · Bold = current
              stock
            </p>
          </div>
        </div>

        <TableShell>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[22%]">Item</TableHead>
                <TableHead className="w-[10%] text-emerald-800">In</TableHead>
                <TableHead className="w-[10%] text-rose-800">Out</TableHead>
                <TableHead className="w-[12%]">Stock</TableHead>
                <TableHead className="w-[8%]">Status</TableHead>
                <TableHead className="w-[22%]">Reorder notice</TableHead>
                <TableHead className="w-[16%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="max-w-none py-10 text-center text-muted-foreground"
                  >
                    No items yet. Add an item with opening stock (counts as In).
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((item) => {
                  const notice = kitchenReorderNotice(item);
                  const status = notice.status;
                  const badgeVariant =
                    status === "out" || status === "low"
                      ? "destructive"
                      : status === "watch"
                        ? "outline"
                        : "secondary";
                  const statusLabel =
                    status === "out"
                      ? "Out of stock"
                      : status === "low"
                        ? "Low"
                        : status === "watch"
                          ? "Watch"
                          : "OK";
                  const qtyIn = Number(item.qty_in) || 0;
                  const qtyOut = Number(item.qty_out) || 0;
                  const stock = Number(item.current_qty) || 0;

                  return (
                    <TableRow key={item.id} className="align-top">
                      <TableCell className="py-3">
                        <CellPrimary
                          title={item.item_name}
                          subtitle={[item.category, item.unit, item.supplier]
                            .filter(Boolean)
                            .join(" · ")}
                        />
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="block text-base font-semibold tabular-nums text-emerald-700">
                          {fmtQty(qtyIn)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="block text-base font-semibold tabular-nums text-rose-700">
                          {fmtQty(qtyOut)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="block text-base font-bold tabular-nums text-stone-900">
                          {fmtQty(stock, item.unit)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          In − Out
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant={badgeVariant}>{statusLabel}</Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <span
                          className={
                            status === "out"
                              ? "text-sm font-medium leading-snug text-destructive"
                              : status === "low" || status === "watch"
                                ? "text-sm leading-snug text-amber-800"
                                : "text-sm leading-snug text-muted-foreground"
                          }
                          title={notice.statement}
                        >
                          {notice.statement}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-none py-3">
                        <TableActions>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                            onClick={() => openMovement(item, "in")}
                          >
                            In
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-rose-300 text-rose-800 hover:bg-rose-50"
                            onClick={() => openMovement(item, "out")}
                          >
                            Out
                          </Button>
                          <Button
                            variant="ghost"
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
        <TablePagination total={total} page={page} onPageChange={setPage} />
      </section>

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
            {!editing ? (
              <div className="space-y-2">
                <Label htmlFor="current_qty">Opening stock (In)</Label>
                <Input
                  id="current_qty"
                  type="number"
                  min="0"
                  step="any"
                  value={form.current_qty}
                  onChange={(e) => field("current_qty", e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Counts as In. Later use In / Out buttons — stock = In − Out.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Current stock</Label>
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm tabular-nums">
                  {fmtQty(editing.current_qty, editing.unit)} (In{" "}
                  {fmtQty(editing.qty_in)} − Out {fmtQty(editing.qty_out)})
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Change stock with In / Out on the table — not here.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reorder_level">Low-stock threshold (qty)</Label>
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

      <Dialog
        open={Boolean(movement)}
        onOpenChange={(next) => {
          if (!next) setMovement(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {movement?.direction === "in" ? "Record In" : "Record Out"}
              {movement ? ` · ${movement.item.item_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {movement ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Current stock{" "}
                <span className="font-medium text-foreground">
                  {fmtQty(movement.item.current_qty, movement.item.unit)}
                </span>
                {" · "}
                {movement.direction === "in"
                  ? "Adds to In and increases stock."
                  : "Adds to Out and decreases stock."}
              </p>
              <div className="space-y-2">
                <Label htmlFor="move_qty">Quantity</Label>
                <Input
                  id="move_qty"
                  type="number"
                  min="0"
                  step="any"
                  value={movement.qty}
                  onChange={(e) =>
                    setMovement((prev) =>
                      prev ? { ...prev, qty: e.target.value } : prev,
                    )
                  }
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="move_notes">Notes (optional)</Label>
                <Textarea
                  id="move_notes"
                  value={movement.notes}
                  onChange={(e) =>
                    setMovement((prev) =>
                      prev ? { ...prev, notes: e.target.value } : prev,
                    )
                  }
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovement(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveMovement()}
              disabled={
                saving ||
                !movement ||
                !(Number(movement.qty) > 0)
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
