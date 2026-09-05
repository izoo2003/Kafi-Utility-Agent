"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Tenant,
  TenantContractExtension,
  TenantRentLineItem,
  TenantRentPayment,
} from "@/lib/types/database";
import type { LedgerRow } from "@/lib/tenants/ledger";
import { paymentRefLabel } from "@/lib/tenants/ledger";
import { formatMoney } from "@/lib/tenants/payment-status";
import { formatDate } from "@/lib/format/datetime";
import { apiFetch } from "@/lib/dashboard/api-client";
import {
  openTenantDocument,
  uploadRentPaymentReceipt,
} from "@/lib/dashboard/tenant-documents";
import { TableShell } from "@/components/dashboard/table-shell";
import { TenantContractExtensionDialog } from "@/components/dashboard/tenant-contract-extension-dialog";
import { formatChangeValue } from "@/components/dashboard/tenant-contract-history";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type PayForm = {
  amount_received: string;
  withholding_tax_received: string;
  payer_bank_name: string;
  payer_bank_account: string;
  payee_bank_name: string;
  payee_bank_account: string;
  cheque_no: string;
  payment_reference: string;
};

const emptyPay = (): PayForm => ({
  amount_received: "",
  withholding_tax_received: "",
  payer_bank_name: "",
  payer_bank_account: "",
  payee_bank_name: "",
  payee_bank_account: "",
  cheque_no: "",
  payment_reference: "",
});

function rateCell(row: LedgerRow) {
  if (row.rate_type === "lum_sum") return "LUM SUM";
  return row.rate == null ? "—" : formatMoney(row.rate);
}

export function TenantRentLedger({
  tenantId,
  tenant,
  rows,
  extensions,
  lineItems,
}: {
  tenantId: string;
  tenant: Tenant;
  rows: LedgerRow[];
  extensions: TenantContractExtension[];
  lineItems: TenantRentLineItem[];
}) {
  const router = useRouter();
  const extensionByPeriodStart = useMemo(() => {
    const map = new Map<string, TenantContractExtension>();
    for (const ext of extensions) map.set(ext.extension_from, ext);
    return map;
  }, [extensions]);
  const latestExtensionId = useMemo(() => {
    const latest = extensions.find(
      (ext) => ext.extension_till === tenant.contract_end_date,
    );
    return latest?.id ?? null;
  }, [extensions, tenant.contract_end_date]);

  async function removeExtension(ext: TenantContractExtension) {
    await apiFetch(`/api/tenants/${tenantId}/contract-extension/${ext.id}`, {
      method: "DELETE",
    });
    router.refresh();
  }
  const extraLabels = useMemo(() => {
    const labels: string[] = [];
    for (const row of rows) {
      for (const item of row.frozen_line_items) {
        if (!labels.includes(item.label)) labels.push(item.label);
      }
    }
    return labels;
  }, [rows]);

  const totals = useMemo(() => {
    return {
      gross: rows.reduce((s, r) => s + Number(r.gross_rent ?? 0), 0),
      withholding: rows.reduce((s, r) => s + Number(r.withholding_tax ?? 0), 0),
      withholdingReceived: rows.reduce(
        (s, r) => s + Number(r.withholding_tax_received ?? 0),
        0,
      ),
      extras: Object.fromEntries(
        extraLabels.map((label) => [
          label,
          rows.reduce(
            (s, r) =>
              s +
              Number(
                r.frozen_line_items.find((i) => i.label === label)?.amount ?? 0,
              ),
            0,
          ),
        ]),
      ) as Record<string, number>,
      received: rows.reduce((s, r) => s + r.received, 0),
      balance: rows.reduce((s, r) => s + r.balance, 0),
    };
  }, [rows, extraLabels]);

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<LedgerRow | null>(null);
  const [form, setForm] = useState<PayForm>(emptyPay);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openPay(row: LedgerRow) {
    setTarget(row);
    setForm({
      ...emptyPay(),
      amount_received: String(
        Math.max(Number(row.total_due ?? 0) - row.received, 0) || "",
      ),
      withholding_tax_received:
        row.withholding_tax_received == null
          ? ""
          : String(row.withholding_tax_received),
    });
    setReceipt(null);
    setError(null);
    setOpen(true);
  }

  async function deletePayment(payment: TenantRentPayment) {
    await apiFetch(`/api/tenants/payments/${payment.id}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  async function savePayment() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      const cheque = form.cheque_no.trim();
      const amount = Number(form.amount_received || 0);
      const body = {
        amount_received: amount,
        withholding_tax_received: showWithholding
          ? Number(form.withholding_tax_received || 0)
          : undefined,
        payer_bank_name: form.payer_bank_name,
        payer_bank_account: form.payer_bank_account,
        payee_bank_name: form.payee_bank_name,
        payee_bank_account: form.payee_bank_account,
        cheque_no: cheque,
        payment_reference:
          form.payment_reference.trim() ||
          (cheque ? `CH # ${cheque}` : null),
      };
      if (amount > 0) {
        const payment = await apiFetch<TenantRentPayment>(
          `/api/tenants/${tenantId}/schedule/${target.id}/payments`,
          { method: "POST", body: JSON.stringify(body) },
        );
        if (receipt) {
          await uploadRentPaymentReceipt(payment.id, receipt);
        }
      } else if (showWithholding) {
        await apiFetch(`/api/tenants/${tenantId}/schedule/${target.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            withholding_tax_received: Number(form.withholding_tax_received || 0),
          }),
        });
      } else {
        throw new Error("Enter an amount received");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const showWithholding = tenant.classification === "official";
  const colCount = (showWithholding ? 11 : 9) + extraLabels.length;

  return (
    <div className="space-y-3">
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">S.No</TableHead>
              <TableHead className="w-52">Month</TableHead>
              <TableHead className="w-20">Survey no.</TableHead>
              <TableHead className="w-16">Sqft</TableHead>
              <TableHead className="w-16">Rate</TableHead>
              <TableHead className="w-24">Gross rent</TableHead>
              {extraLabels.map((label) => (
                <TableHead key={label} className="w-24">
                  {label}
                </TableHead>
              ))}
              <TableHead className="w-24">Received</TableHead>
              <TableHead className="w-24">Balance</TableHead>
              {showWithholding ? (
                <>
                  <TableHead className="w-28">Withholding tax</TableHead>
                  <TableHead className="w-32">Withholding tax received</TableHead>
                </>
              ) : null}
              <TableHead className="w-28">Cheque / ref</TableHead>
              <TableHead className="w-44 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="max-w-none py-8 text-center text-muted-foreground"
                >
                  No monthly rows yet. Edit the tenant and set agreement dates.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const ext = extensionByPeriodStart.get(row.period_start);
                const isLatestExt = ext != null && ext.id === latestExtensionId;
                return (
                <Fragment key={row.id}>
                  {ext ? (
                    <TableRow
                      key={`ext-${ext.id}`}
                      className="bg-[oklch(0.97_0.03_195)]"
                    >
                      <TableCell colSpan={colCount} className="max-w-none py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs">
                            <span className="font-medium">
                              Extension started {formatDate(ext.extension_from)}
                              {" – "}
                              {formatDate(ext.extension_till)}
                            </span>
                            {ext.changes.length > 0 ? (
                              <span className="text-muted-foreground">
                                {" · "}
                                {ext.changes
                                  .map(
                                    (c) =>
                                      `${c.label}: ${formatChangeValue(c.field, c.old_value)} → ${formatChangeValue(c.field, c.new_value)}`,
                                  )
                                  .join("; ")}
                              </span>
                            ) : null}
                          </div>
                          {isLatestExt ? (
                            <div className="flex shrink-0 gap-1">
                              <TenantContractExtensionDialog
                                tenant={tenant}
                                lineItems={lineItems}
                                extension={ext}
                                trigger={(openDialog) => (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={openDialog}
                                  >
                                    Edit
                                  </Button>
                                )}
                              />
                              <ConfirmDeleteButton
                                title="Delete this contract extension?"
                                description="Removes the months it added and reverts the contract terms it changed. Only possible while none of those months have a payment recorded."
                                onConfirm={() => removeExtension(ext)}
                              />
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                <TableRow key={row.id}>
                  <TableCell>{row.serial_no}</TableCell>
                  <TableCell>{row.month_label}</TableCell>
                  <TableCell>{row.survey_no ?? "—"}</TableCell>
                  <TableCell>
                    {row.sqft == null ? "—" : Number(row.sqft).toLocaleString()}
                  </TableCell>
                  <TableCell>{rateCell(row)}</TableCell>
                  <TableCell>{formatMoney(row.gross_rent)}</TableCell>
                  {extraLabels.map((label) => (
                    <TableCell key={label}>
                      {formatMoney(
                        row.frozen_line_items.find((i) => i.label === label)
                          ?.amount,
                      )}
                    </TableCell>
                  ))}
                  <TableCell>{row.received ? formatMoney(row.received) : ""}</TableCell>
                  <TableCell>
                    {row.received > 0 && row.balance === 0
                      ? "—"
                      : formatMoney(row.balance)}
                  </TableCell>
                  {showWithholding ? (
                    <>
                      <TableCell>
                        {row.withholding_tax
                          ? formatMoney(row.withholding_tax)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {row.withholding_tax_received
                          ? formatMoney(row.withholding_tax_received)
                          : ""}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell>{paymentRefLabel(row.payments)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPay(row)}
                      >
                        Record payment
                      </Button>
                      {row.payments.map((payment) => (
                        <Fragment key={payment.id}>
                          {payment.payment_file_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                void openTenantDocument(
                                  `/api/tenants/payments/${payment.id}/receipt`,
                                )
                              }
                            >
                              Receipt
                            </Button>
                          ) : null}
                          <ConfirmDeleteButton
                            label="Delete"
                            title="Delete this payment?"
                            description="Removes the received amount from the ledger. This cannot be undone."
                            onConfirm={() => deletePayment(payment)}
                          />
                        </Fragment>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
                </Fragment>
                );
              })
            )}
            {rows.length > 0 ? (
              <TableRow className="font-medium">
                <TableCell colSpan={5}>Totals</TableCell>
                <TableCell>{formatMoney(totals.gross)}</TableCell>
                {extraLabels.map((label) => (
                  <TableCell key={label}>
                    {formatMoney(totals.extras[label])}
                  </TableCell>
                ))}
                <TableCell>{formatMoney(totals.received)}</TableCell>
                <TableCell>{formatMoney(totals.balance)}</TableCell>
                {showWithholding ? (
                  <>
                    <TableCell>{formatMoney(totals.withholding)}</TableCell>
                    <TableCell>
                      {formatMoney(totals.withholdingReceived)}
                    </TableCell>
                  </>
                ) : null}
                <TableCell colSpan={2} />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Record payment
              {target ? ` — ${target.month_label}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
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
            {showWithholding ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Withholding tax received</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.withholding_tax_received}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      withholding_tax_received: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Unpaid tax (WHT − this amount) is added to the month balance.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>From bank</Label>
              <Input
                value={form.payer_bank_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payer_bank_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>From account no.</Label>
              <Input
                value={form.payer_bank_account}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payer_bank_account: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>To bank</Label>
              <Input
                value={form.payee_bank_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payee_bank_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>To account no.</Label>
              <Input
                value={form.payee_bank_account}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payee_bank_account: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Cheque no.</Label>
              <Input
                value={form.cheque_no}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cheque_no: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={form.payment_reference}
                placeholder="Optional slip / TID"
                onChange={(e) =>
                  setForm((p) => ({ ...p, payment_reference: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Receipt (optional)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
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
            <Button onClick={() => void savePayment()} disabled={saving}>
              {saving ? "Saving…" : "Save payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
