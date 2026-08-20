"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tenant, TenantPaymentStatus } from "@/lib/types/database";
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
  CellPrimary,
  CellText,
  TableActions,
  TableShell,
} from "@/components/dashboard/table-shell";
import {
  effectivePaymentStatus,
  formatMoney,
  paymentStatusBadgeClass,
  TENANT_PAYMENT_STATUS_LABELS,
} from "@/lib/tenants/payment-status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type FormState = {
  tenant_name: string;
  rent_amount: string;
  rent_due_date: string;
  payment_status: TenantPaymentStatus;
  payment_date: string;
  outstanding_amount: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  tenant_name: "",
  rent_amount: "",
  rent_due_date: "",
  payment_status: "unpaid",
  payment_date: "",
  outstanding_amount: "",
  notes: "",
});

function toForm(item: Tenant): FormState {
  return {
    tenant_name: item.tenant_name,
    rent_amount: item.rent_amount == null ? "" : String(item.rent_amount),
    rent_due_date: item.rent_due_date ?? "",
    payment_status: item.payment_status,
    payment_date: item.payment_date ?? "",
    outstanding_amount:
      item.outstanding_amount == null ? "" : String(item.outstanding_amount),
    notes: item.notes ?? "",
  };
}

function toPayload(form: FormState) {
  return {
    tenant_name: form.tenant_name.trim(),
    rent_amount: form.rent_amount === "" ? null : Number(form.rent_amount),
    rent_due_date: form.rent_due_date || null,
    payment_status: form.payment_status,
    payment_date: form.payment_date || null,
    outstanding_amount:
      form.outstanding_amount === "" ? null : Number(form.outstanding_amount),
    notes: form.notes,
  };
}

export function TenantsPanel({ initialItems }: { initialItems: Tenant[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => sortNewestFirst(items), [items]);
  const { page, setPage, pageRows, total } = usePagedRows(sorted);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
  }

  function startEdit(item: Tenant) {
    setEditing(item);
    setForm(toForm(item));
    setError(null);
  }

  async function save() {
    if (!form.tenant_name.trim()) {
      setError("Tenant name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form);
      if (editing) {
        const data = await apiFetch<Tenant>(`/api/tenants/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<Tenant>("/api/tenants", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setItems((prev) => upsertById(prev, data));
      }
      startCreate();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await apiFetch(`/api/tenants/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editing?.id === id) startCreate();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Tenants · Create tenant"
          description="Create a separate account for each tenant. Current rent, due date, payment status, and outstanding amount are stored here and copied into rent records."
          icon="tenants"
          accent="violet"
        />
        <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
          <ExportButtons resource="tenants" />
          <ImportFilesButton target="tenants" />
        </div>
      </div>

      <TenantSectionNav active="create" />

      <section className="space-y-4 rounded-xl border border-[oklch(0.88_0.02_290)] bg-white/70 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">
              {editing ? `Edit ${editing.tenant_name}` : "New tenant account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Dates use DD/MM/YYYY on screen. Saving also writes a rent log for
              this due date.
            </p>
          </div>
          {editing ? (
            <Button variant="outline" onClick={startCreate}>
              Cancel edit
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tenant-name">Tenant name</Label>
            <Input
              id="tenant-name"
              value={form.tenant_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, tenant_name: e.target.value }))
              }
              placeholder="e.g. Ali Khan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rent-amount">Rent amount</Label>
            <Input
              id="rent-amount"
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
            <Label htmlFor="rent-due">Rent due date</Label>
            <Input
              id="rent-due"
              type="date"
              value={form.rent_due_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, rent_due_date: e.target.value }))
              }
            />
          </div>
          <PaymentStatusSelect
            id="payment-status"
            value={form.payment_status}
            onChange={(payment_status) =>
              setForm((p) => ({ ...p, payment_status }))
            }
          />
          <div className="space-y-2">
            <Label htmlFor="payment-date">Payment date</Label>
            <Input
              id="payment-date"
              type="date"
              value={form.payment_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, payment_date: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="outstanding">Outstanding / overdue amount</Label>
            <Input
              id="outstanding"
              type="number"
              min="0"
              step="any"
              value={form.outstanding_amount}
              onChange={(e) =>
                setForm((p) => ({ ...p, outstanding_amount: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tenant-notes">Notes</Label>
            <Textarea
              id="tenant-notes"
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

        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            {saving
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create tenant"}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tenant accounts</h2>
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">Tenant</TableHead>
                <TableHead className="w-[12%]">Rent</TableHead>
                <TableHead className="w-[12%]">Due date</TableHead>
                <TableHead className="w-[12%]">Status</TableHead>
                <TableHead className="w-[12%]">Paid on</TableHead>
                <TableHead className="w-[14%]">Outstanding</TableHead>
                <TableHead className="w-[20%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No tenants yet. Fill in the form above to create an account.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((item) => {
                  const status = effectivePaymentStatus(
                    item.payment_status,
                    item.rent_due_date,
                  );
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <CellPrimary title={item.tenant_name} />
                      </TableCell>
                      <TableCell>
                        <CellText>{formatMoney(item.rent_amount)}</CellText>
                      </TableCell>
                      <TableCell>
                        <CellText>{formatDate(item.rent_due_date)}</CellText>
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
                        <CellText>{formatDate(item.payment_date)}</CellText>
                      </TableCell>
                      <TableCell>
                        <CellText>
                          {formatMoney(item.outstanding_amount)}
                        </CellText>
                      </TableCell>
                      <TableCell className="max-w-none">
                        <TableActions>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </Button>
                          <ConfirmDeleteButton
                            title={`Delete ${item.tenant_name}?`}
                            description="This also deletes their rent records and electricity bills."
                            onConfirm={() => remove(item.id)}
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
        {sorted.length > 0 ? (
          <TablePagination total={total} page={page} onPageChange={setPage} />
        ) : null}
      </section>
    </div>
  );
}
