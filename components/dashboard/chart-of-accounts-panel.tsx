"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ChartOfAccountsEntry,
  ChartOfAccountsLedger,
} from "@/lib/types/database";
import { formatDate } from "@/lib/format/datetime";
import {
  isIsoDateInRange,
  normalizeToIsoDate,
} from "@/lib/validations/helpers";
import { apiFetch } from "@/lib/dashboard/api-client";
import { upsertById } from "@/lib/dashboard/sort";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { withRunningBalances } from "@/lib/chart-of-accounts/balance";
import { chartOfAccountsSectionMeta } from "@/lib/dashboard/chart-of-accounts-sections";
import { PageHeader } from "@/components/dashboard/page-header";
import { ChartOfAccountsSectionNav } from "@/components/dashboard/chart-of-accounts-section-nav";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ImportFilesButton } from "@/components/dashboard/import-files-button";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { TablePagination } from "@/components/dashboard/table-pagination";
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

type EntryForm = {
  entry_date: string;
  ref_no: string;
  account_description: string;
  document_no: string;
  debit: string;
  credit: string;
  notes: string;
};

const emptyForm = (): EntryForm => ({
  entry_date: "",
  ref_no: "",
  account_description: "",
  document_no: "",
  debit: "",
  credit: "",
  notes: "",
});

function formatMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ChartOfAccountsPanel({
  ledger,
  initialEntries,
}: {
  ledger: ChartOfAccountsLedger;
  initialEntries: ChartOfAccountsEntry[];
}) {
  const router = useRouter();
  const meta = chartOfAccountsSectionMeta(ledger);
  const [entries, setEntries] = useState(initialEntries);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChartOfAccountsEntry | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const chronological = useMemo(() => {
    return [...entries].sort((a, b) => {
      const d = a.entry_date.localeCompare(b.entry_date);
      if (d !== 0) return d;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [entries]);

  const withBalances = useMemo(
    () => withRunningBalances(chronological),
    [chronological],
  );

  const filtered = useMemo(() => {
    if (!dateFrom && !dateTo) return withBalances;
    return withBalances.filter((row) =>
      isIsoDateInRange(row.entry_date, dateFrom, dateTo),
    );
  }, [withBalances, dateFrom, dateTo]);

  const displayRows = useMemo(
    () => [...filtered].reverse(),
    [filtered],
  );

  const { page, setPage, pageRows, total } = usePagedRows(displayRows);

  const totalDebit = useMemo(
    () => filtered.reduce((sum, r) => sum + (Number(r.debit) || 0), 0),
    [filtered],
  );
  const totalCredit = useMemo(
    () => filtered.reduce((sum, r) => sum + (Number(r.credit) || 0), 0),
    [filtered],
  );
  const closingBalance =
    filtered.length > 0 ? filtered[filtered.length - 1]!.balance : 0;

  const rangeActive = Boolean(dateFrom || dateTo);

  const dataDateSpan = useMemo(() => {
    const dates = entries
      .map((r) => normalizeToIsoDate(r.entry_date))
      .filter((d): d is string => Boolean(d))
      .sort();
    if (!dates.length) return null;
    return { min: dates[0]!, max: dates[dates.length - 1]! };
  }, [entries]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ledger,
        entry_date: form.entry_date,
        ref_no: form.ref_no,
        account_description: form.account_description,
        document_no: form.document_no,
        debit: form.debit === "" ? 0 : Number(form.debit),
        credit: form.credit === "" ? 0 : Number(form.credit),
        notes: form.notes,
      };
      if (editing) {
        const data = await apiFetch<ChartOfAccountsEntry>(
          `/api/chart-of-accounts/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setEntries((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<ChartOfAccountsEntry>(
          "/api/chart-of-accounts",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setEntries((prev) => upsertById(prev, data));
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
        title="Chart of Accounts"
        description={`${meta.label} — account ledger with running balance`}
        icon="accounts"
        accent="amber"
      />
      <ChartOfAccountsSectionNav active={ledger} />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">{meta.label}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons resource="chart-of-accounts" />
            <ImportFilesButton target="chart-of-accounts" />
            <Button
              onClick={() => {
                setEditing(null);
                setForm(emptyForm());
                setError(null);
                setOpen(true);
              }}
            >
              Add entry
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[oklch(0.88_0.02_85)] bg-[oklch(0.985_0.01_85)] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="coa-from" className="text-xs">
                From (entry date)
              </Label>
              <Input
                id="coa-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-[11.5rem]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coa-to" className="text-xs">
                To (entry date)
              </Label>
              <Input
                id="coa-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-[11.5rem]"
              />
            </div>
            {rangeActive ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
              >
                Clear dates
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Debit total: </span>
              <span className="font-medium">{formatMoney(totalDebit)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Credit total: </span>
              <span className="font-medium">{formatMoney(totalCredit)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Balance: </span>
              <span className="font-medium">{formatMoney(closingBalance)}</span>
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {filtered.length} row{filtered.length === 1 ? "" : "s"}
            {rangeActive
              ? ` in range${dateFrom ? ` from ${formatDate(dateFrom)}` : ""}${dateTo ? ` to ${formatDate(dateTo)}` : ""}`
              : ""}{" "}
            · dates DD/MM/YYYY · newest first
          </p>
        </div>

        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[10%]">Date</TableHead>
                <TableHead className="w-[10%]">Ref No</TableHead>
                <TableHead className="w-[16%]">Accounts / Description</TableHead>
                <TableHead className="w-[22%]">Document #</TableHead>
                <TableHead className="w-[10%]">Debit</TableHead>
                <TableHead className="w-[10%]">Credit</TableHead>
                <TableHead className="w-[10%]">Balance</TableHead>
                <TableHead className="w-[12%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    {rangeActive
                      ? dataDateSpan
                        ? `No entries in this date range. Existing rows span ${formatDate(dataDateSpan.min)} – ${formatDate(dataDateSpan.max)}.`
                        : "No entries in this date range."
                      : "No ledger entries yet. Import the Excel ledger or add a row."}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <CellText>{formatDate(row.entry_date)}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.ref_no ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.account_description ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.document_no ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {Number(row.debit)
                          ? formatMoney(Number(row.debit))
                          : "—"}
                      </CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {Number(row.credit)
                          ? formatMoney(Number(row.credit))
                          : "—"}
                      </CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{formatMoney(row.balance)}</CellText>
                    </TableCell>
                    <TableCell className="max-w-none">
                      <TableActions>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing(row);
                            setForm({
                              entry_date: row.entry_date,
                              ref_no: row.ref_no ?? "",
                              account_description:
                                row.account_description ?? "",
                              document_no: row.document_no ?? "",
                              debit: String(row.debit ?? ""),
                              credit: String(row.credit ?? ""),
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
                            await apiFetch(
                              `/api/chart-of-accounts/${row.id}`,
                              { method: "DELETE" },
                            );
                            setEntries((prev) =>
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
        <TablePagination total={total} page={page} onPageChange={setPage} />
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit ledger entry" : "Add ledger entry"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.entry_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, entry_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Ref No</Label>
              <Input
                value={form.ref_no}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ref_no: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Accounts / Description</Label>
              <Input
                value={form.account_description}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    account_description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Document #</Label>
              <Input
                value={form.document_no}
                onChange={(e) =>
                  setForm((p) => ({ ...p, document_no: e.target.value }))
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
              <Label>Credit</Label>
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
              disabled={saving || !form.entry_date}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
