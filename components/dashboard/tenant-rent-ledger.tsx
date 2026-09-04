"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantRentPayment } from "@/lib/types/database";
import type { LedgerRow } from "@/lib/tenants/ledger";
import { paymentRefLabel } from "@/lib/tenants/ledger";
import { formatMoney } from "@/lib/tenants/payment-status";
import { apiFetch } from "@/lib/dashboard/api-client";
import {
  openTenantDocument,
  uploadRentPaymentReceipt,
} from "@/lib/dashboard/tenant-documents";
import { TableShell } from "@/components/dashboard/table-shell";
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
  payer_bank_name: string;
  payer_bank_account: string;
  payee_bank_name: string;
  payee_bank_account: string;
  cheque_no: string;
  payment_reference: string;
};

const emptyPay = (): PayForm => ({
  amount_received: "",
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
  rows,
}: {
  tenantId: string;
  rows: LedgerRow[];
}) {
  const router = useRouter();
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
      amount_received: String(Math.max(row.balance, 0) || row.total_due || ""),
    });
    setReceipt(null);
    setError(null);
    setOpen(true);
  }

  async function savePayment() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      const cheque = form.cheque_no.trim();
      const payment = await apiFetch<TenantRentPayment>(
        `/api/tenants/${tenantId}/schedule/${target.id}/payments`,
        {
          method: "POST",
          body: JSON.stringify({
            amount_received: Number(form.amount_received || 0),
            payer_bank_name: form.payer_bank_name,
            payer_bank_account: form.payer_bank_account,
            payee_bank_name: form.payee_bank_name,
            payee_bank_account: form.payee_bank_account,
            cheque_no: cheque,
            payment_reference:
              form.payment_reference.trim() ||
              (cheque ? `CH # ${cheque}` : null),
          }),
        },
      );
      if (receipt) {
        await uploadRentPaymentReceipt(payment.id, receipt);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const colCount = 10 + extraLabels.length;

  return (
    <div className="space-y-3">
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>S.No</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Survey no.</TableHead>
              <TableHead>Sqft</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Gross rent</TableHead>
              {extraLabels.map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
              <TableHead>Withholding</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Cheque / ref</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
              rows.map((row) => (
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
                  <TableCell>
                    {row.withholding_tax
                      ? formatMoney(row.withholding_tax)
                      : "—"}
                  </TableCell>
                  <TableCell>{row.received ? formatMoney(row.received) : ""}</TableCell>
                  <TableCell>
                    {row.received > 0 && row.balance === 0
                      ? "—"
                      : formatMoney(row.balance)}
                  </TableCell>
                  <TableCell>{paymentRefLabel(row.payments)}</TableCell>
                  <TableCell className="max-w-none text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPay(row)}
                      >
                        Record payment
                      </Button>
                      {row.payments.map((payment) =>
                        payment.payment_file_url ? (
                          <Button
                            key={payment.id}
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
                        ) : null,
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
                <TableCell>{formatMoney(totals.withholding)}</TableCell>
                <TableCell>{formatMoney(totals.received)}</TableCell>
                <TableCell>{formatMoney(totals.balance)}</TableCell>
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
              Record payment{target ? ` — ${target.month_label}` : ""}
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
