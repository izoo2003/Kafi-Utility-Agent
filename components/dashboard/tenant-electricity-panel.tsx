"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Tenant,
  TenantElectricBill,
  TenantPaymentStatus,
} from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { sortNewestFirst, upsertById } from "@/lib/dashboard/sort";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ImportFilesButton } from "@/components/dashboard/import-files-button";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { PaymentStatusSelect } from "@/components/dashboard/tenant-payment-status-select";
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
import { cn } from "@/lib/utils";
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
  ke_charges_amount: string;
  due_date: string;
  payment_status: TenantPaymentStatus;
  payment_date: string;
  outstanding_amount: string;
  notes: string;
};

const emptyBill = (): BillForm => ({
  ke_charges_amount: "",
  due_date: "",
  payment_status: "unpaid",
  payment_date: todayIso(),
  outstanding_amount: "",
  notes: "",
});

function toBillForm(log: TenantElectricBill): BillForm {
  return {
    ke_charges_amount:
      log.ke_charges_amount == null ? "" : String(log.ke_charges_amount),
    due_date: log.due_date ?? "",
    payment_status: log.payment_status,
    payment_date: log.payment_date ?? "",
    outstanding_amount:
      log.outstanding_amount == null ? "" : String(log.outstanding_amount),
    notes: log.notes ?? "",
  };
}

function toBillPayload(form: BillForm, tenantId: string) {
  return {
    tenant_id: tenantId,
    ke_charges_amount:
      form.ke_charges_amount === "" ? null : Number(form.ke_charges_amount),
    due_date: form.due_date || null,
    payment_status: form.payment_status,
    payment_date: form.payment_date || null,
    outstanding_amount:
      form.outstanding_amount === "" ? null : Number(form.outstanding_amount),
    notes: form.notes,
  };
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenant = tenants.find((t) => t.id === tenantId) ?? null;
  const tenantBills = useMemo(
    () =>
      sortNewestFirst(bills.filter((b) => b.tenant_id === tenantId)).sort(
        (a, b) =>
          (b.due_date ?? "").localeCompare(a.due_date ?? "") ||
          b.created_at.localeCompare(a.created_at),
      ),
    [bills, tenantId],
  );
  const { page, setPage, pageRows, total } = usePagedRows(tenantBills);
  const latest = tenantBills[0] ?? null;
  const latestStatus = latest
    ? effectivePaymentStatus(latest.payment_status, latest.due_date)
    : null;

  function openCreate() {
    setEditing(null);
    setForm(emptyBill());
    setError(null);
    setOpen(true);
  }

  function openEdit(bill: TenantElectricBill) {
    setEditing(bill);
    setForm(toBillForm(bill));
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!tenantId) {
      setError("Select a tenant first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = toBillPayload(form, tenantId);
      if (editing) {
        const data = await apiFetch<TenantElectricBill>(
          `/api/tenants/electric-bills/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setBills((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<TenantElectricBill>(
          "/api/tenants/electric-bills",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setBills((prev) => upsertById(prev, data));
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
          description="K-Electric charges billed to each tenant — amount, due date, payment status, and outstanding balance."
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
          <Link href="/dashboard/tenants" className="font-medium text-primary underline">
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
                  <p className="text-xs text-muted-foreground">Last KE charges</p>
                  <p className="text-sm font-medium">
                    {formatMoney(latest?.ke_charges_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due date</p>
                  <p className="text-sm font-medium">
                    {formatDate(latest?.due_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last paid</p>
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
                    <TableHead className="w-[16%]">Tenant</TableHead>
                    <TableHead className="w-[14%]">KE charges</TableHead>
                    <TableHead className="w-[12%]">Due date</TableHead>
                    <TableHead className="w-[12%]">Status</TableHead>
                    <TableHead className="w-[12%]">Payment date</TableHead>
                    <TableHead className="w-[14%]">Outstanding</TableHead>
                    <TableHead className="w-[20%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantBills.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="max-w-none py-8 text-center text-muted-foreground"
                      >
                        No electricity bills for this tenant yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((bill) => {
                      const status = effectivePaymentStatus(
                        bill.payment_status,
                        bill.due_date,
                      );
                      return (
                        <TableRow key={bill.id}>
                          <TableCell>
                            <CellText>{tenant?.tenant_name ?? "—"}</CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {formatMoney(bill.ke_charges_amount)}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>{formatDate(bill.due_date)}</CellText>
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
                            <CellText>{formatDate(bill.payment_date)}</CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {formatMoney(bill.outstanding_amount)}
                            </CellText>
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
              <TablePagination total={total} page={page} onPageChange={setPage} />
            ) : null}
          </section>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit electricity bill" : "Log electricity bill"}
              {tenant ? ` — ${tenant.tenant_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>KE charges amount</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.ke_charges_amount}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    ke_charges_amount: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, due_date: e.target.value }))
                }
              />
            </div>
            <PaymentStatusSelect
              value={form.payment_status}
              onChange={(payment_status) =>
                setForm((p) => ({ ...p, payment_status }))
              }
            />
            <div className="space-y-2">
              <Label>Payment date</Label>
              <Input
                type="date"
                value={form.payment_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payment_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Outstanding amount</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.outstanding_amount}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    outstanding_amount: e.target.value,
                  }))
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
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
