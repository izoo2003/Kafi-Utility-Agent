"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GeneratorExpense } from "@/lib/types/database";
import { formatDate } from "@/lib/format/datetime";
import { apiFetch } from "@/lib/dashboard/api-client";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import {
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

type ExpenseForm = {
  expense_date: string;
  account: string;
  description: string;
  debit: string;
  credit: string;
  notes: string;
};

const emptyExpense = (): ExpenseForm => ({
  expense_date: "",
  account: "",
  description: "",
  debit: "",
  credit: "",
  notes: "",
});

function formatMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function GeneratorExpensesSection({
  initialExpenses,
}: {
  initialExpenses: GeneratorExpense[];
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GeneratorExpense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyExpense);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () =>
      [...expenses].sort((a, b) =>
        b.expense_date.localeCompare(a.expense_date),
      ),
    [expenses],
  );

  const totalDebit = useMemo(
    () => expenses.reduce((sum, r) => sum + (Number(r.debit) || 0), 0),
    [expenses],
  );

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        expense_date: form.expense_date,
        account: form.account,
        description: form.description,
        debit: form.debit === "" ? 0 : Number(form.debit),
        credit: form.credit === "" ? null : Number(form.credit),
        notes: form.notes,
      };
      if (editing) {
        const data = await apiFetch<GeneratorExpense>(
          `/api/generator/expenses/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setExpenses((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<GeneratorExpense>(
          "/api/generator/expenses",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setExpenses((prev) => [...prev, data]);
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
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium">Expenses</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons resource="generator-expenses" />
          <Button
            onClick={() => {
              setEditing(null);
              setForm(emptyExpense());
              setError(null);
              setOpen(true);
            }}
          >
            Add expense
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[oklch(0.88_0.02_220)] bg-[oklch(0.985_0.01_220)] px-4 py-3 sm:px-5">
        <p className="text-sm font-medium text-foreground">
          Total expense (sum of debit): {formatMoney(totalDebit)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {expenses.length} row{expenses.length === 1 ? "" : "s"} · dates shown
          as DD/MM/YYYY
        </p>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[12%]">Date</TableHead>
              <TableHead className="w-[18%]">Account</TableHead>
              <TableHead className="w-[28%]">Description</TableHead>
              <TableHead className="w-[12%]">Debit</TableHead>
              <TableHead className="w-[12%]">Credit</TableHead>
              <TableHead className="w-[18%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="max-w-none py-8 text-center text-muted-foreground"
                >
                  No expenses yet. Import from a PDF in chat or add a row.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <CellText>{formatDate(row.expense_date)}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>{row.account ?? "—"}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>{row.description ?? "—"}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>{formatMoney(Number(row.debit) || 0)}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>
                      {row.credit == null ? "—" : formatMoney(Number(row.credit))}
                    </CellText>
                  </TableCell>
                  <TableCell className="max-w-none">
                    <TableActions>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(row);
                          setForm({
                            expense_date: row.expense_date,
                            account: row.account ?? "",
                            description: row.description ?? "",
                            debit: String(row.debit ?? ""),
                            credit:
                              row.credit == null ? "" : String(row.credit),
                            notes: row.notes ?? "",
                          });
                          setError(null);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <ConfirmDeleteButton
                        onConfirm={async () => {
                          await apiFetch(`/api/generator/expenses/${row.id}`, {
                            method: "DELETE",
                          });
                          setExpenses((prev) =>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit expense" : "Add expense"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.expense_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, expense_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Debit</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.debit}
                onChange={(e) =>
                  setForm((p) => ({ ...p, debit: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Input
                value={form.account}
                onChange={(e) =>
                  setForm((p) => ({ ...p, account: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Credit (optional)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.credit}
                onChange={(e) =>
                  setForm((p) => ({ ...p, credit: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
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
            <Button
              onClick={() => void save()}
              disabled={saving || !form.expense_date}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
