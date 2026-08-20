"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Tenant,
  TenantPaymentStatus,
  TenantRentLog,
} from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { sortNewestFirst, upsertById } from "@/lib/dashboard/sort";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { PageHeader } from "@/components/dashboard/page-header";
import { TenantSectionNav } from "@/components/dashboard/tenant-section-nav";
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

type RentForm = {
  rent_amount: string;
  rent_due_date: string;
  payment_status: TenantPaymentStatus;
  payment_date: string;
  outstanding_amount: string;
  notes: string;
};

const emptyRent = (): RentForm => ({
  rent_amount: "",
  rent_due_date: "",
  payment_status: "unpaid",
  payment_date: todayIso(),
  outstanding_amount: "",
  notes: "",
});

function toRentForm(log: TenantRentLog): RentForm {
  return {
    rent_amount: log.rent_amount == null ? "" : String(log.rent_amount),
    rent_due_date: log.rent_due_date ?? "",
    payment_status: log.payment_status,
    payment_date: log.payment_date ?? "",
    outstanding_amount:
      log.outstanding_amount == null ? "" : String(log.outstanding_amount),
    notes: log.notes ?? "",
  };
}

function toRentPayload(form: RentForm, tenantId: string) {
  return {
    tenant_id: tenantId,
    rent_amount: form.rent_amount === "" ? null : Number(form.rent_amount),
    rent_due_date: form.rent_due_date || null,
    payment_status: form.payment_status,
    payment_date: form.payment_date || null,
    outstanding_amount:
      form.outstanding_amount === "" ? null : Number(form.outstanding_amount),
    notes: form.notes,
  };
}

export function TenantRecordsPanel({
  initialTenants,
  initialLogs,
  initialTenantId,
}: {
  initialTenants: Tenant[];
  initialLogs: TenantRentLog[];
  initialTenantId?: string | null;
}) {
  const router = useRouter();
  const [tenants, setTenants] = useState(initialTenants);
  const [logs, setLogs] = useState(initialLogs);
  const [tenantId, setTenantId] = useState(
    initialTenantId && initialTenants.some((t) => t.id === initialTenantId)
      ? initialTenantId
      : (initialTenants[0]?.id ?? ""),
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRentLog | null>(null);
  const [form, setForm] = useState<RentForm>(emptyRent);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenant = tenants.find((t) => t.id === tenantId) ?? null;
  const tenantLogs = useMemo(
    () =>
      sortNewestFirst(logs.filter((l) => l.tenant_id === tenantId)).sort(
        (a, b) =>
          (b.rent_due_date ?? "").localeCompare(a.rent_due_date ?? "") ||
          b.created_at.localeCompare(a.created_at),
      ),
    [logs, tenantId],
  );
  const { page, setPage, pageRows, total } = usePagedRows(tenantLogs);
  const latest = tenantLogs[0] ?? null;
  const currentStatus = tenant
    ? effectivePaymentStatus(tenant.payment_status, tenant.rent_due_date)
    : "unpaid";

  function openCreate() {
    if (!tenant) return;
    setEditing(null);
    setForm({
      ...emptyRent(),
      rent_amount: tenant.rent_amount == null ? "" : String(tenant.rent_amount),
      rent_due_date: tenant.rent_due_date ?? "",
      outstanding_amount:
        tenant.outstanding_amount == null
          ? ""
          : String(tenant.outstanding_amount),
    });
    setError(null);
    setOpen(true);
  }

  function openEdit(log: TenantRentLog) {
    setEditing(log);
    setForm(toRentForm(log));
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
      const payload = toRentPayload(form, tenantId);
      if (editing) {
        const data = await apiFetch<TenantRentLog>(
          `/api/tenants/rent-logs/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setLogs((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<TenantRentLog>("/api/tenants/rent-logs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setLogs((prev) => upsertById(prev, data));
      }
      const refreshed = await apiFetch<Tenant>(`/api/tenants/${tenantId}`);
      setTenants((prev) => prev.map((t) => (t.id === refreshed.id ? refreshed : t)));
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await apiFetch(`/api/tenants/rent-logs/${id}`, { method: "DELETE" });
    setLogs((prev) => prev.filter((i) => i.id !== id));
    if (tenantId) {
      try {
        const refreshed = await apiFetch<Tenant>(`/api/tenants/${tenantId}`);
        setTenants((prev) =>
          prev.map((t) => (t.id === refreshed.id ? refreshed : t)),
        );
      } catch {
        /* snapshot refresh is best-effort */
      }
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Tenants · Rent records"
          description="Pick a tenant to view their rent logs — last paid, due date, status, and outstanding amount."
          icon="tenants"
          accent="violet"
        />
        <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
          <ExportButtons resource="tenant-rent" />
          <ImportFilesButton target="tenant-rent" />
        </div>
      </div>

      <TenantSectionNav active="records" />

      {tenants.length === 0 ? (
        <div className="rounded-xl border border-[oklch(0.88_0.02_290)] bg-white/70 px-4 py-6 text-sm text-muted-foreground">
          No tenants yet.{" "}
          <Link href="/dashboard/tenants" className="font-medium text-primary underline">
            Create a tenant
          </Link>{" "}
          first, then rent records will appear here in a dropdown.
        </div>
      ) : (
        <>
          <div className="space-y-2 rounded-xl border border-[oklch(0.88_0.02_290)] bg-[oklch(0.99_0.01_290)] px-4 py-4 sm:px-5">
            <Label htmlFor="tenant-select">Tenant</Label>
            <select
              id="tenant-select"
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
              One tenant at a time — same pattern as Utilities (K-Electric, SSGC,
              KWSB).
            </p>
          </div>

          {tenant ? (
            <section
              className={cn(
                "space-y-3 rounded-xl border px-4 py-4 sm:px-5",
                currentStatus === "overdue"
                  ? "border-[oklch(0.82_0.08_25)] bg-[oklch(0.97_0.02_25)]"
                  : "border-[oklch(0.88_0.02_290)] bg-white/70",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-medium">{tenant.tenant_name}</h2>
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                        paymentStatusBadgeClass(currentStatus),
                      )}
                    >
                      {TENANT_PAYMENT_STATUS_LABELS[currentStatus]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Current rent snapshot. History of each due period is below.
                  </p>
                </div>
                <Button onClick={openCreate}>Log rent</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Rent amount</p>
                  <p className="text-sm font-medium">
                    {formatMoney(tenant.rent_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rent due date</p>
                  <p className="text-sm font-medium">
                    {formatDate(tenant.rent_due_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last paid</p>
                  <p className="text-sm font-medium">
                    {formatDate(latest?.payment_date ?? tenant.payment_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="text-sm font-medium">
                    {formatMoney(tenant.outstanding_amount)}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-base font-medium">
              Rent history{tenant ? ` — ${tenant.tenant_name}` : ""}
            </h3>
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[16%]">Due date</TableHead>
                    <TableHead className="w-[14%]">Rent amount</TableHead>
                    <TableHead className="w-[14%]">Status</TableHead>
                    <TableHead className="w-[14%]">Payment date</TableHead>
                    <TableHead className="w-[14%]">Outstanding</TableHead>
                    <TableHead className="w-[14%]">Notes</TableHead>
                    <TableHead className="w-[14%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="max-w-none py-8 text-center text-muted-foreground"
                      >
                        No rent logs for this tenant yet. Use Log rent after each
                        payment.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((log) => {
                      const status = effectivePaymentStatus(
                        log.payment_status,
                        log.rent_due_date,
                      );
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <CellText>{formatDate(log.rent_due_date)}</CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>{formatMoney(log.rent_amount)}</CellText>
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
                            <CellText>{formatDate(log.payment_date)}</CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>
                              {formatMoney(log.outstanding_amount)}
                            </CellText>
                          </TableCell>
                          <TableCell>
                            <CellText>{log.notes || "—"}</CellText>
                          </TableCell>
                          <TableCell className="max-w-none">
                            <TableActions>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(log)}
                              >
                                Edit
                              </Button>
                              <ConfirmDeleteButton
                                onConfirm={() => remove(log.id)}
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
            {tenantLogs.length > 0 ? (
              <TablePagination total={total} page={page} onPageChange={setPage} />
            ) : null}
          </section>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit rent log" : "Log rent"}
              {tenant ? ` — ${tenant.tenant_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Rent amount</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.rent_amount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, rent_amount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Rent due date</Label>
              <Input
                type="date"
                value={form.rent_due_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, rent_due_date: e.target.value }))
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
              <Label>Outstanding / overdue amount</Label>
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
