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
import { DocumentFileField } from "@/components/dashboard/document-file-field";
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
import {
  agreementExpiryLabel,
  agreementExpiryStatus,
} from "@/lib/tenants/agreement";
import {
  openTenantDocument,
  uploadTenantAgreement,
  uploadTenantPayment,
} from "@/lib/dashboard/tenant-documents";
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
  agreement_expiry: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  tenant_name: "",
  rent_amount: "",
  rent_due_date: "",
  payment_status: "unpaid",
  payment_date: "",
  outstanding_amount: "",
  agreement_expiry: "",
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
    agreement_expiry: item.agreement_expiry ?? "",
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
    agreement_expiry: form.agreement_expiry || null,
    notes: form.notes,
  };
}

export function TenantsPanel({ initialItems }: { initialItems: Tenant[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [removingKind, setRemovingKind] = useState<"agreement" | "payment" | null>(
    null,
  );

  const sorted = useMemo(() => sortNewestFirst(items), [items]);
  const { page, setPage, pageRows, total } = usePagedRows(sorted);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm());
    setAgreementFile(null);
    setPaymentFile(null);
    setError(null);
    setSuccess(null);
  }

  function startEdit(item: Tenant) {
    setEditing(item);
    setForm(toForm(item));
    setAgreementFile(null);
    setPaymentFile(null);
    setError(null);
    setSuccess(null);
  }

  async function save() {
    if (!form.tenant_name.trim()) {
      setError("Tenant name is required.");
      setSuccess(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = toPayload(form);
      let saved: Tenant;
      if (editing) {
        saved = await apiFetch<Tenant>(`/api/tenants/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        saved = await apiFetch<Tenant>("/api/tenants", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      if (agreementFile) {
        saved = await uploadTenantAgreement<Tenant>(saved.id, agreementFile);
      }
      if (paymentFile) {
        saved = await uploadTenantPayment<Tenant>(saved.id, paymentFile);
      }
      setItems((prev) =>
        editing
          ? prev.map((i) => (i.id === saved.id ? saved : i))
          : upsertById(prev, saved),
      );
      setSuccess(
        editing
          ? `${saved.tenant_name} saved.`
          : `${saved.tenant_name} saved — see the table below and Rent records.`,
      );
      setEditing(saved);
      setForm(toForm(saved));
      setAgreementFile(null);
      setPaymentFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void save();
  }

  async function remove(id: string) {
    await apiFetch(`/api/tenants/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editing?.id === id) startCreate();
    router.refresh();
  }

  async function removeAgreement() {
    if (!editing) return;
    setRemovingKind("agreement");
    setError(null);
    try {
      const data = await apiFetch<Tenant>(
        `/api/tenants/${editing.id}/agreement`,
        { method: "DELETE" },
      );
      setEditing(data);
      setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      setAgreementFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove agreement");
    } finally {
      setRemovingKind(null);
    }
  }

  async function removePayment() {
    if (!editing) return;
    setRemovingKind("payment");
    setError(null);
    try {
      const data = await apiFetch<Tenant>(`/api/tenants/${editing.id}/payment`, {
        method: "DELETE",
      });
      setEditing(data);
      setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      setPaymentFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove payment file");
    } finally {
      setRemovingKind(null);
    }
  }

  const expiring = items.filter((t) => {
    const status = agreementExpiryStatus(t.agreement_expiry);
    return status === "soon" || status === "expired";
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Tenants · Create tenant"
          description="Create a separate account for each tenant. Current rent, due date, payment status, outstanding amount, agreement expiry, and agreement/payment files are stored here."
          icon="tenants"
          accent="violet"
        />
        <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
          <ExportButtons resource="tenants" />
          <ImportFilesButton target="tenants" />
        </div>
      </div>

      <TenantSectionNav active="create" />

      {expiring.length > 0 ? (
        <div
          className="rounded-xl border border-[oklch(0.82_0.08_55)] bg-[oklch(0.98_0.03_85)] px-4 py-3"
          role="status"
        >
          <p className="text-sm font-medium">Agreement expiry</p>
          <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {expiring.map((t) => {
              const status = agreementExpiryStatus(t.agreement_expiry);
              return (
                <li key={t.id}>
                  {t.tenant_name}: {agreementExpiryLabel(status)}
                  {t.agreement_expiry ? ` (${formatDate(t.agreement_expiry)})` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <form
        className="space-y-4 rounded-xl border border-[oklch(0.88_0.02_290)] bg-white/70 px-4 py-4 sm:px-5"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-medium">
              {editing ? `Edit ${editing.tenant_name}` : "New tenant account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Fill in the details, then click Save tenant. Dates use DD/MM/YYYY on
              screen. Saving also writes a rent log for this due date. Agreement
              expiry triggers a dashboard popup from 1 month before the end date.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 self-start">
            {editing ? (
              <Button type="button" variant="outline" onClick={startCreate}>
                Cancel edit
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForm(emptyForm());
                  setAgreementFile(null);
                  setPaymentFile(null);
                  setError(null);
                  setSuccess(null);
                }}
              >
                Clear form
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Save tenant"}
            </Button>
          </div>
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
          <div className="space-y-2">
            <Label htmlFor="agreement-expiry">Agreement expiry</Label>
            <Input
              id="agreement-expiry"
              type="date"
              value={form.agreement_expiry}
              onChange={(e) =>
                setForm((p) => ({ ...p, agreement_expiry: e.target.value }))
              }
            />
          </div>
          <DocumentFileField
            id="agreement-file"
            label="Agreement (photo or PDF)"
            hint="Lease / tenancy agreement scan."
            existingPath={editing?.agreement_file_url ?? null}
            onFileChange={setAgreementFile}
            onView={
              editing?.agreement_file_url
                ? () =>
                    void openTenantDocument(
                      `/api/tenants/${editing.id}/agreement`,
                    )
                : undefined
            }
            onRemove={editing?.agreement_file_url ? () => void removeAgreement() : undefined}
            removing={removingKind === "agreement"}
          />
          <DocumentFileField
            id="payment-file"
            label="Payment receipt (photo or PDF)"
            hint="Receipt for the current rent payment."
            existingPath={editing?.payment_file_url ?? null}
            onFileChange={setPaymentFile}
            onView={
              editing?.payment_file_url
                ? () =>
                    void openTenantDocument(
                      `/api/tenants/${editing.id}/payment`,
                    )
                : undefined
            }
            onRemove={editing?.payment_file_url ? () => void removePayment() : undefined}
            removing={removingKind === "payment"}
          />
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

        {success ? (
          <p
            className="rounded-lg border border-[oklch(0.88_0.04_145)] bg-[oklch(0.97_0.02_145)] px-3 py-2 text-sm text-[oklch(0.35_0.08_145)]"
            role="status"
          >
            {success}
          </p>
        ) : null}

        <div className="flex justify-end border-t border-[oklch(0.92_0.01_290)] pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Save tenant"}
          </Button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tenant accounts</h2>
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[16%]">Tenant</TableHead>
                <TableHead className="w-[11%]">Rent</TableHead>
                <TableHead className="w-[12%]">Due date</TableHead>
                <TableHead className="w-[11%]">Status</TableHead>
                <TableHead className="w-[12%]">Paid on</TableHead>
                <TableHead className="w-[12%]">Agreement</TableHead>
                <TableHead className="w-[12%]">Outstanding</TableHead>
                <TableHead className="w-[14%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
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
                  const agreement = agreementExpiryStatus(item.agreement_expiry);
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
                        {agreement === "none" ? (
                          <CellText>—</CellText>
                        ) : (
                          <span className="flex flex-col gap-0.5">
                            <CellText>{formatDate(item.agreement_expiry)}</CellText>
                            {agreement !== "ok" ? (
                              <span
                                className={cn(
                                  "inline-flex w-fit rounded-md px-2 py-0.5 text-xs font-medium",
                                  agreement === "expired"
                                    ? "bg-[oklch(0.93_0.05_25)] text-[oklch(0.4_0.12_25)]"
                                    : "bg-[oklch(0.95_0.06_85)] text-[oklch(0.42_0.1_55)]",
                                )}
                              >
                                {agreementExpiryLabel(agreement)}
                              </span>
                            ) : null}
                          </span>
                        )}
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
