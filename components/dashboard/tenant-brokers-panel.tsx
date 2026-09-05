"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Tenant } from "@/lib/types/database";
import type { TenantBrokerListRow } from "@/lib/supabase/tenant-brokers";
import { apiFetch } from "@/lib/dashboard/api-client";
import { upsertById } from "@/lib/dashboard/sort";
import { formatDate } from "@/lib/format/datetime";
import { formatMoney } from "@/lib/tenants/payment-status";
import {
  computeBrokerCommission,
  monthlyRentForBroker,
  stayLabel,
} from "@/lib/tenants/broker-commission";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import {
  CellText,
  TableActions,
  TableShell,
} from "@/components/dashboard/table-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  broker_name: string;
  tenant_id: string;
  sqft: string;
  rate: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  broker_name: "",
  tenant_id: "",
  sqft: "",
  rate: "",
  notes: "",
});

function numOrNull(value: string) {
  return value === "" ? null : Number(value);
}

function toForm(row: TenantBrokerListRow): FormState {
  return {
    broker_name: row.broker_name,
    tenant_id: row.tenant_id,
    sqft: row.sqft == null ? "" : String(row.sqft),
    rate: row.rate == null ? "" : String(row.rate),
    notes: row.notes ?? "",
  };
}

export function TenantBrokersPanel({
  initialItems,
  tenants,
}: {
  initialItems: TenantBrokerListRow[];
  tenants: Tenant[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TenantBrokerListRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenantById = useMemo(
    () => new Map(tenants.map((t) => [t.id, t])),
    [tenants],
  );

  const selected = form.tenant_id ? tenantById.get(form.tenant_id) : null;
  const preview = useMemo(() => {
    if (!selected) return null;
    const monthly = monthlyRentForBroker({
      sqft: numOrNull(form.sqft),
      rate: numOrNull(form.rate),
      fallback_gross: selected.gross_rent,
    });
    return computeBrokerCommission({
      monthly_rent: monthly,
      contract_start_date: selected.contract_start_date,
      contract_end_date: selected.contract_end_date,
    });
  }, [selected, form.sqft, form.rate]);

  function applyTenant(tenantId: string) {
    const tenant = tenantById.get(tenantId);
    setForm((p) => ({
      ...p,
      tenant_id: tenantId,
      sqft: tenant?.sqft == null ? "" : String(tenant.sqft),
      rate: tenant?.rate == null ? "" : String(tenant.rate),
    }));
  }

  async function save() {
    if (!form.broker_name.trim()) {
      setError("Broker name is required.");
      return;
    }
    if (!form.tenant_id) {
      setError("Select a tenant.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        broker_name: form.broker_name.trim(),
        tenant_id: form.tenant_id,
        sqft: numOrNull(form.sqft),
        rate: numOrNull(form.rate),
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const data = await apiFetch<TenantBrokerListRow>(
          `/api/tenant-brokers/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setRows((prev) => prev.map((r) => (r.id === data.id ? data : r)));
      } else {
        const data = await apiFetch<TenantBrokerListRow>(
          "/api/tenant-brokers",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setRows((prev) => upsertById(prev, data));
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Brokers"
          description="Commission slips: monthly rent ÷ 12 × how long the tenant’s contract runs (leftover days count as days/30)."
          icon="tenants"
          accent="violet"
        />
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          <ExportButtons resource="tenant-brokers" />
          <Link
            href="/dashboard/tenants"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            All tenants
          </Link>
          <Button
            onClick={() => {
              setEditing(null);
              setForm(emptyForm());
              setError(null);
              setOpen(true);
            }}
          >
            Add broker
          </Button>
        </div>
      </div>

      {error && !open ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <TableShell>
        <Table style={{ minWidth: "64rem" }}>
          <TableHeader>
            <TableRow>
              <TableHead>Broker</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Sqft</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Stay</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="max-w-none py-8 text-center text-muted-foreground"
                >
                  No brokers yet. Add a broker and pick a tenant to calculate
                  commission from their contract.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <CellText className="font-medium">{row.broker_name}</CellText>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <CellText>{row.tenant_name || "—"}</CellText>
                      {row.survey_no ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Survey {row.survey_no}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <CellText className="tabular-nums">
                      {row.sqft == null ? "—" : formatMoney(row.sqft)}
                    </CellText>
                  </TableCell>
                  <TableCell>
                    <CellText className="tabular-nums">
                      {row.rate == null ? "—" : formatMoney(row.rate)}
                    </CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>
                      {stayLabel({
                        full_months: row.stay_months,
                        leftover_days: row.stay_days,
                        stay_factor: row.stay_factor,
                      })}
                    </CellText>
                    {row.contract_start_date && row.contract_end_date ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(row.contract_start_date)} –{" "}
                        {formatDate(row.contract_end_date)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <CellText className="tabular-nums font-medium">
                      {formatMoney(row.commission_amount)}
                    </CellText>
                  </TableCell>
                  <TableCell className="max-w-none">
                    <TableActions>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(row);
                          setForm(toForm(row));
                          setError(null);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <ConfirmDeleteButton
                        title={`Delete ${row.broker_name}?`}
                        description="This removes the commission slip. The tenant account is not deleted."
                        onConfirm={async () => {
                          await apiFetch(`/api/tenant-brokers/${row.id}`, {
                            method: "DELETE",
                          });
                          setRows((prev) => prev.filter((r) => r.id !== row.id));
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit broker" : "Add broker"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="broker_name">Broker name</Label>
              <Input
                id="broker_name"
                value={form.broker_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, broker_name: e.target.value }))
                }
                placeholder="e.g. Osama Broker"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant_id">Tenant</Label>
              <select
                id="tenant_id"
                className="flex h-9 w-full rounded-lg border border-input bg-white px-3 text-sm"
                value={form.tenant_id}
                onChange={(e) => applyTenant(e.target.value)}
              >
                <option value="">Select tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.tenant_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="broker_sqft">Sqft</Label>
              <Input
                id="broker_sqft"
                type="number"
                min="0"
                step="any"
                value={form.sqft}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sqft: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="broker_rate">Rate</Label>
              <Input
                id="broker_rate"
                type="number"
                min="0"
                step="any"
                value={form.rate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, rate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="broker_notes">Notes</Label>
              <Textarea
                id="broker_notes"
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>
          </div>

          {preview && selected ? (
            <div className="rounded-lg border border-[oklch(0.88_0.02_290)] bg-[oklch(0.99_0.01_290)] px-3 py-3 text-sm">
              <p className="font-medium">
                Commission — {selected.survey_no ? `Survey ${selected.survey_no}` : selected.tenant_name}
              </p>
              <dl className="mt-2 grid gap-1.5">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Monthly rent</dt>
                  <dd className="tabular-nums">
                    {form.sqft && form.rate
                      ? `${form.sqft} × ${form.rate} = ${formatMoney(preview.monthly_rent)}`
                      : formatMoney(preview.monthly_rent)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Stay</dt>
                  <dd>
                    {stayLabel(preview)}
                    {selected.contract_start_date && selected.contract_end_date
                      ? ` (${formatDate(selected.contract_start_date)} – ${formatDate(selected.contract_end_date)})`
                      : ""}
                  </dd>
                </div>
                {preview.full_months > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      For {preview.full_months} month
                      {preview.full_months === 1 ? "" : "s"}
                    </dt>
                    <dd className="tabular-nums">
                      {formatMoney(preview.month_commission)}
                    </dd>
                  </div>
                ) : null}
                {preview.leftover_days > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      Day {preview.leftover_days}
                    </dt>
                    <dd className="tabular-nums">
                      {formatMoney(preview.day_commission)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-[oklch(0.9_0.02_290)] pt-1.5 font-medium">
                  <dt>Total commission</dt>
                  <dd className="tabular-nums">
                    {formatMoney(preview.commission_amount)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a tenant to fill sqft, rate, and commission from their
              contract.
            </p>
          )}

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
