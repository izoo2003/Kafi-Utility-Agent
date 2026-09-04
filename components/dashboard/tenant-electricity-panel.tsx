"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Tenant, TenantElectricBill } from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { sortNewestFirst, upsertById } from "@/lib/dashboard/sort";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ImportFilesButton } from "@/components/dashboard/import-files-button";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { formatDate } from "@/lib/format/datetime";
import {
  CellText,
  TableActions,
  TableShell,
} from "@/components/dashboard/table-shell";
import {
  effectivePaymentStatus,
  formatMoney,
  paymentStatusBadgeClass,
  TENANT_PAYMENT_STATUS_LABELS,
  todayIso,
} from "@/lib/tenants/payment-status";
import {
  billAmount,
  billingMonths,
  consumedUnits,
  derivePayment,
  formatBillingPeriod,
  formatMonthsLabel,
} from "@/lib/tenants/electricity";
import { cn } from "@/lib/utils";
import {
  openTenantDocument,
  uploadElectricBillFile,
} from "@/lib/dashboard/tenant-documents";
import { fileNameFromStoragePath } from "@/lib/supabase/tenant-storage";
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

type BillForm = {
  period_from: string;
  period_to: string;
  last_reading: string;
  current_reading: string;
  rate_inclusive_govt: string;
  amount_received: string;
  payment_date: string;
  notes: string;
};

const emptyBill = (lastReading = ""): BillForm => ({
  period_from: "",
  period_to: "",
  last_reading: lastReading,
  current_reading: "",
  rate_inclusive_govt: "",
  amount_received: "",
  payment_date: todayIso(),
  notes: "",
});

function toBillForm(log: TenantElectricBill): BillForm {
  return {
    period_from: log.period_from ?? "",
    period_to: log.period_to ?? "",
    last_reading: log.last_reading == null ? "" : String(log.last_reading),
    current_reading:
      log.current_reading == null ? "" : String(log.current_reading),
    rate_inclusive_govt:
      log.rate_inclusive_govt == null ? "" : String(log.rate_inclusive_govt),
    amount_received:
      log.amount_received == null ? "" : String(log.amount_received),
    payment_date: log.payment_date ?? "",
    notes: log.notes ?? "",
  };
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBillPayload(form: BillForm, tenantId: string) {
  return {
    tenant_id: tenantId,
    period_from: form.period_from,
    period_to: form.period_to,
    last_reading: parseOptionalNumber(form.last_reading),
    current_reading: parseOptionalNumber(form.current_reading),
    rate_inclusive_govt: parseOptionalNumber(form.rate_inclusive_govt),
    amount_received: parseOptionalNumber(form.amount_received),
    payment_date: form.payment_date || null,
    notes: form.notes,
  };
}

function liveDerived(form: BillForm) {
  const last = parseOptionalNumber(form.last_reading);
  const current = parseOptionalNumber(form.current_reading);
  const rate = parseOptionalNumber(form.rate_inclusive_govt);
  const received = parseOptionalNumber(form.amount_received);
  const months = billingMonths(form.period_from || null, form.period_to || null);
  const units = consumedUnits(last, current);
  const amount = billAmount(units, rate);
  const payment = derivePayment(amount, received, form.period_to || null);
  return { months, units, amount, payment };
}

export function TenantElectricityPanel({
  initialTenants,
  initialBills,
  initialTenantId,
  embedded = false,
}: {
  initialTenants: Tenant[];
  initialBills: TenantElectricBill[];
  initialTenantId?: string | null;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [tenants] = useState(initialTenants);
  const [bills, setBills] = useState(initialBills);
  const [tenantId, setTenantId] = useState(
    initialTenantId && initialTenants.some((t) => t.id === initialTenantId)
      ? initialTenantId
      : (initialTenants[0]?.id ?? ""),
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TenantElectricBill | null>(null);
  const [form, setForm] = useState<BillForm>(emptyBill);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenant = tenants.find((t) => t.id === tenantId) ?? null;
  const tenantBills = useMemo(
    () =>
      sortNewestFirst(bills.filter((b) => b.tenant_id === tenantId)).sort(
        (a, b) =>
          (b.period_to ?? b.due_date ?? "").localeCompare(
            a.period_to ?? a.due_date ?? "",
          ) || b.created_at.localeCompare(a.created_at),
      ),
    [bills, tenantId],
  );
  const { page, setPage, pageRows, total } = usePagedRows(tenantBills);
  const latest = tenantBills[0] ?? null;
  const latestStatus = latest
    ? effectivePaymentStatus(
        latest.payment_status,
        latest.period_to ?? latest.due_date,
      )
    : null;
  const derived = liveDerived(form);

  function openCreate() {
    const prevReading =
      latest?.current_reading != null ? String(latest.current_reading) : "";
    setEditing(null);
    setForm(emptyBill(prevReading));
    setBillFile(null);
    setError(null);
    setOpen(true);
  }

  function openEdit(bill: TenantElectricBill) {
    setEditing(bill);
    setForm(toBillForm(bill));
    setBillFile(null);
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!tenantId) {
      setError("Select a tenant first.");
      return;
    }
    if (!form.period_from || !form.period_to) {
      setError("From and To dates are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = toBillPayload(form, tenantId);
      let saved: TenantElectricBill;
      if (editing) {
        saved = await apiFetch<TenantElectricBill>(
          `/api/tenants/electric-bills/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setBills((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
      } else {
        saved = await apiFetch<TenantElectricBill>(
          "/api/tenants/electric-bills",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setBills((prev) => upsertById(prev, saved));
      }
      if (billFile) {
        const withFile = await uploadElectricBillFile<TenantElectricBill>(
          saved.id,
          billFile,
        );
        setBills((prev) =>
          prev.map((i) => (i.id === withFile.id ? withFile : i)),
        );
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
    await apiFetch(`/api/tenants/electric-bills/${id}`, { method: "DELETE" });
    setBills((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {embedded ? null : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <PageHeader
              title="Tenants · Electricity bills"
              description="Meter ledger: period, readings, rate, amount received, and bill attachment."
              icon="tenants"
              accent="violet"
            />
            <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
              <ExportButtons resource="tenant-electricity" />
              <ImportFilesButton target="tenant-electricity" />
            </div>
          </div>
        </>
      )}

      {tenants.length === 0 ? (
        <div className="rounded-xl border border-[oklch(0.88_0.02_290)] bg-white/70 px-4 py-6 text-sm text-muted-foreground">
          No tenants yet.{" "}
          <Link
            href="/dashboard/tenants"
            className="font-medium text-primary underline"
          >
            Create a tenant
          </Link>{" "}
          first, then log their electricity bills here.
        </div>
      ) : (
        <>
          {embedded ? (
            <div className="flex justify-end">
              <Button onClick={openCreate}>Log electricity bill</Button>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-[oklch(0.88_0.02_290)] bg-[oklch(0.99_0.01_290)] px-4 py-4 sm:px-5">
              <Label htmlFor="tenant-electric-select">Tenant</Label>
              <select
                id="tenant-electric-select"
                className="flex h-10 w-full max-w-md rounded-lg border border-input bg-white px-3 text-sm"
                value={tenantId}
                onChange={(e) => {
                  setTenantId(e.target.value);
                  setError(null);
                  setPage(1);
                }}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tenant_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Electricity bills for the selected tenant only. Site K-Electric
                meters stay under Utilities.
              </p>
            </div>
          )}

          {tenant && !embedded ? (
            <section
              className={cn(
                "space-y-3 rounded-xl border px-4 py-4 sm:px-5",
                latestStatus === "overdue"
                  ? "border-[oklch(0.82_0.08_25)] bg-[oklch(0.97_0.02_25)]"
                  : "border-[oklch(0.88_0.02_290)] bg-white/70",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-medium">{tenant.tenant_name}</h2>
                    {latestStatus ? (
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                          paymentStatusBadgeClass(latestStatus),
                        )}
                      >
                        {TENANT_PAYMENT_STATUS_LABELS[latestStatus]}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Tenant electricity (K-Electric) charges — separate from site
                    utility meters.
                  </p>
                </div>
                <Button onClick={openCreate}>Log electricity bill</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Latest period</p>
                  <p className="text-sm font-medium">
                    {formatBillingPeriod(latest?.period_from, latest?.period_to)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-sm font-medium">
                    {formatMoney(latest?.ke_charges_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date received</p>
                  <p className="text-sm font-medium">
                    {formatDate(latest?.payment_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="text-sm font-medium">
                    {formatMoney(latest?.outstanding_amount)}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-base font-medium">
              Electricity history{tenant ? ` — ${tenant.tenant_name}` : ""}
            </h3>
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Months</TableHead>
                    <TableHead>Last</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Consumed</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Date received</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bill</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantBills.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={12}
                        className="max-w-none py-8 text-center text-muted-foreground"
                      >
                        No electricity bills for this tenant yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((bill) => {
                      const status = effectivePaymentStatus(
                        bill.payment_status,
                        bill.period_to ?? bill.due_date,
                      );
                      return (
                        <TableRow key={bill.id}>
                          <TableCell>
                            <CellText>
                              {formatBillingPeriod(
                                bill.period_from,
                                bill.period_to,
                              )}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {formatMonthsLabel(bill.months)}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {bill.last_reading == null
                                ? "—"
                                : bill.last_reading}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {bill.current_reading == null
                                ? "—"
                                : bill.current_reading}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {bill.consumed_units == null
                                ? "—"
                                : bill.consumed_units}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {bill.rate_inclusive_govt == null
                                ? "—"
                                : bill.rate_inclusive_govt}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {formatMoney(bill.ke_charges_amount)}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {formatMoney(bill.amount_received)}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {formatDate(bill.payment_date)}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                                paymentStatusBadgeClass(status),
                              )}
                            >
                              {TENANT_PAYMENT_STATUS_LABELS[status]}
                            </span>
                          </TableCell>
                          <TableCell>
                            {bill.bill_file_url ? (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto max-w-[8rem] truncate p-0 text-xs"
                                onClick={() =>
                                  void openTenantDocument(
                                    `/api/tenants/electric-bills/${bill.id}/bill`,
                                  )
                                }
                              >
                                {fileNameFromStoragePath(bill.bill_file_url) ||
                                  "View"}
                              </Button>
                            ) : (
                              <CellText>—</CellText>
                            )}
                          </TableCell>
                          <TableCell className="max-w-none">
                            <TableActions>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(bill)}
                              >
                                Edit
                              </Button>
                              <ConfirmDeleteButton
                                onConfirm={() => remove(bill.id)}
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
            {tenantBills.length > 0 ? (
              <TablePagination
                total={total}
                page={page}
                onPageChange={setPage}
              />
            ) : null}
          </section>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit electricity bill" : "Log electricity bill"}
              {tenant ? ` — ${tenant.tenant_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From date</Label>
              <Input
                type="date"
                value={form.period_from}
                onChange={(e) =>
                  setForm((p) => ({ ...p, period_from: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>To date</Label>
              <Input
                type="date"
                value={form.period_to}
                onChange={(e) =>
                  setForm((p) => ({ ...p, period_to: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Months</Label>
              <Input
                readOnly
                value={
                  derived.months == null
                    ? ""
                    : formatMonthsLabel(derived.months)
                }
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Last reading</Label>
              <Input
                type="number"
                step="any"
                value={form.last_reading}
                onChange={(e) =>
                  setForm((p) => ({ ...p, last_reading: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Current reading</Label>
              <Input
                type="number"
                step="any"
                value={form.current_reading}
                onChange={(e) =>
                  setForm((p) => ({ ...p, current_reading: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Consumed units</Label>
              <Input
                readOnly
                value={derived.units == null ? "" : String(derived.units)}
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Rate inclusive govt chg</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.rate_inclusive_govt}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    rate_inclusive_govt: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                readOnly
                value={
                  derived.amount == null ? "" : formatMoney(derived.amount)
                }
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount received</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.amount_received}
                onChange={(e) =>
                  setForm((p) => ({ ...p, amount_received: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Date received</Label>
              <Input
                type="date"
                value={form.payment_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payment_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Outstanding</Label>
              <Input
                readOnly
                value={formatMoney(derived.payment.outstanding_amount)}
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div
                className={cn(
                  "flex h-10 items-center rounded-lg border px-3 text-sm",
                  paymentStatusBadgeClass(derived.payment.payment_status),
                )}
              >
                {TENANT_PAYMENT_STATUS_LABELS[derived.payment.payment_status]}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Bill attachment (optional)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setBillFile(e.target.files?.[0] ?? null)}
              />
              {editing?.bill_file_url && !billFile ? (
                <p className="text-xs text-muted-foreground">
                  Current:{" "}
                  {fileNameFromStoragePath(editing.bill_file_url) || "attached"}
                </p>
              ) : null}
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
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
