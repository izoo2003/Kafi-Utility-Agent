"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Tenant, TenantRateType, TenantRentLineItem } from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { DocumentFileField } from "@/components/dashboard/document-file-field";
import {
  openTenantDocument,
  uploadTenantAgreement,
} from "@/lib/dashboard/tenant-documents";
import { computeGrossRent } from "@/lib/tenants/ledger";
import { countCalendarMonths } from "@/lib/tenants/schedule";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LineForm = { label: string; amount: string };

type FormState = {
  tenant_name: string;
  survey_no: string;
  contract_start_date: string;
  contract_end_date: string;
  security_deposit_amount: string;
  security_deposit_bank_account: string;
  security_deposit_bank_name: string;
  security_deposit_cheque_no: string;
  sqft: string;
  rate: string;
  rate_type: TenantRateType;
  gross_rent: string;
  contract_detail: string;
  notes: string;
  line_items: LineForm[];
};

const emptyForm = (): FormState => ({
  tenant_name: "",
  survey_no: "",
  contract_start_date: "",
  contract_end_date: "",
  security_deposit_amount: "",
  security_deposit_bank_account: "",
  security_deposit_bank_name: "",
  security_deposit_cheque_no: "",
  sqft: "",
  rate: "",
  rate_type: "per_sqft",
  gross_rent: "",
  contract_detail: "",
  notes: "",
  line_items: [],
});

function numOrNull(value: string) {
  return value === "" ? null : Number(value);
}

function toForm(tenant: Tenant, lineItems: TenantRentLineItem[]): FormState {
  return {
    tenant_name: tenant.tenant_name,
    survey_no: tenant.survey_no ?? "",
    contract_start_date: tenant.contract_start_date ?? "",
    contract_end_date: tenant.contract_end_date ?? "",
    security_deposit_amount:
      tenant.security_deposit_amount == null
        ? ""
        : String(tenant.security_deposit_amount),
    security_deposit_bank_account: tenant.security_deposit_bank_account ?? "",
    security_deposit_bank_name: tenant.security_deposit_bank_name ?? "",
    security_deposit_cheque_no: tenant.security_deposit_cheque_no ?? "",
    sqft: tenant.sqft == null ? "" : String(tenant.sqft),
    rate: tenant.rate == null ? "" : String(tenant.rate),
    rate_type: tenant.rate_type === "lum_sum" ? "lum_sum" : "per_sqft",
    gross_rent: tenant.gross_rent == null ? "" : String(tenant.gross_rent),
    contract_detail: tenant.contract_detail ?? "",
    notes: tenant.notes ?? "",
    line_items: lineItems.map((item) => ({
      label: item.label,
      amount: String(item.amount ?? ""),
    })),
  };
}

export function TenantForm({
  tenant,
  lineItems = [],
  paymentCount = 0,
}: {
  tenant?: Tenant | null;
  lineItems?: TenantRentLineItem[];
  paymentCount?: number;
}) {
  const router = useRouter();
  const editing = tenant ?? null;
  const [form, setForm] = useState<FormState>(() =>
    editing ? toForm(editing, lineItems) : emptyForm(),
  );
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [regenerate, setRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingAgreement, setRemovingAgreement] = useState(false);

  const monthCount = useMemo(() => {
    if (!form.contract_start_date || !form.contract_end_date) return 0;
    if (form.contract_end_date < form.contract_start_date) return 0;
    return countCalendarMonths(form.contract_start_date, form.contract_end_date);
  }, [form.contract_start_date, form.contract_end_date]);

  const autoGross = useMemo(() => {
    return computeGrossRent({
      rate_type: form.rate_type,
      sqft: numOrNull(form.sqft),
      rate: numOrNull(form.rate),
      gross_rent: numOrNull(form.gross_rent),
    });
  }, [form.rate_type, form.sqft, form.rate, form.gross_rent]);

  function payload() {
    return {
      tenant_name: form.tenant_name.trim(),
      survey_no: form.survey_no,
      contract_start_date: form.contract_start_date,
      contract_end_date: form.contract_end_date,
      security_deposit_amount: numOrNull(form.security_deposit_amount),
      security_deposit_bank_account: form.security_deposit_bank_account,
      security_deposit_bank_name: form.security_deposit_bank_name,
      security_deposit_cheque_no: form.security_deposit_cheque_no,
      sqft: numOrNull(form.sqft),
      rate: numOrNull(form.rate),
      rate_type: form.rate_type,
      gross_rent:
        form.rate_type === "per_sqft" ? autoGross : numOrNull(form.gross_rent),
      contract_detail: form.contract_detail,
      notes: form.notes,
      line_items: form.line_items
        .filter((item) => item.label.trim())
        .map((item) => ({
          label: item.label.trim(),
          amount: Number(item.amount || 0),
        })),
      ...(editing ? { regenerate_schedule: regenerate } : {}),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/tenants/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload()),
        });
        if (agreementFile) {
          await uploadTenantAgreement(editing.id, agreementFile);
        }
        router.push(`/dashboard/tenants/${editing.id}`);
        router.refresh();
        return;
      }
      const created = await apiFetch<Tenant>("/api/tenants", {
        method: "POST",
        body: JSON.stringify(payload()),
      });
      if (agreementFile) {
        await uploadTenantAgreement(created.id, agreementFile);
      }
      router.push(`/dashboard/tenants/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-4 rounded-xl border border-[oklch(0.88_0.02_290)] bg-white/70 px-4 py-4 sm:px-5"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">
            {editing ? `Edit ${editing.tenant_name}` : "New tenant"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Contract From/To dates create one ledger row per calendar month.
            Gross rent is sqft × rate unless you choose lum sum.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={editing ? `/dashboard/tenants/${editing.id}` : "/dashboard/tenants"}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Cancel
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Save tenant"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tenant_name">Tenant name</Label>
          <Input
            id="tenant_name"
            required
            value={form.tenant_name}
            onChange={(e) => setForm((p) => ({ ...p, tenant_name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="survey_no">Survey no.</Label>
          <Input
            id="survey_no"
            value={form.survey_no}
            onChange={(e) => setForm((p) => ({ ...p, survey_no: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract_start_date">Agreement from</Label>
          <Input
            id="contract_start_date"
            type="date"
            required
            value={form.contract_start_date}
            onChange={(e) =>
              setForm((p) => ({ ...p, contract_start_date: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract_end_date">Agreement to</Label>
          <Input
            id="contract_end_date"
            type="date"
            required
            value={form.contract_end_date}
            onChange={(e) =>
              setForm((p) => ({ ...p, contract_end_date: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Months on ledger</Label>
          <p className="flex h-9 items-center text-sm font-medium">
            {monthCount > 0 ? `${monthCount} month${monthCount === 1 ? "" : "s"}` : "—"}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="security_deposit_amount">Security deposit</Label>
          <Input
            id="security_deposit_amount"
            type="number"
            min="0"
            step="any"
            value={form.security_deposit_amount}
            onChange={(e) =>
              setForm((p) => ({ ...p, security_deposit_amount: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="security_deposit_bank_name">Deposit bank</Label>
          <Input
            id="security_deposit_bank_name"
            value={form.security_deposit_bank_name}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                security_deposit_bank_name: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="security_deposit_bank_account">Deposit account no.</Label>
          <Input
            id="security_deposit_bank_account"
            value={form.security_deposit_bank_account}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                security_deposit_bank_account: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="security_deposit_cheque_no">Deposit cheque no.</Label>
          <Input
            id="security_deposit_cheque_no"
            value={form.security_deposit_cheque_no}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                security_deposit_cheque_no: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rate_type">Rate type</Label>
          <select
            id="rate_type"
            className="flex h-9 w-full rounded-lg border border-input bg-white px-3 text-sm"
            value={form.rate_type}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                rate_type: e.target.value as TenantRateType,
              }))
            }
          >
            <option value="per_sqft">Per sqft (auto gross rent)</option>
            <option value="lum_sum">Lum sum (flat monthly rent)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sqft">Sqft</Label>
          <Input
            id="sqft"
            type="number"
            min="0"
            step="any"
            value={form.sqft}
            onChange={(e) => setForm((p) => ({ ...p, sqft: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rate">Rate</Label>
          <Input
            id="rate"
            type="number"
            min="0"
            step="any"
            disabled={form.rate_type === "lum_sum"}
            value={form.rate}
            onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gross_rent">Gross rent</Label>
          <Input
            id="gross_rent"
            type="number"
            min="0"
            step="any"
            readOnly={form.rate_type === "per_sqft"}
            value={
              form.rate_type === "per_sqft"
                ? autoGross == null
                  ? ""
                  : String(autoGross)
                : form.gross_rent
            }
            onChange={(e) =>
              setForm((p) => ({ ...p, gross_rent: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="contract_detail">Contract detail (optional)</Label>
          <Input
            id="contract_detail"
            value={form.contract_detail}
            onChange={(e) =>
              setForm((p) => ({ ...p, contract_detail: e.target.value }))
            }
            placeholder="Shown on the tenant header if filled"
          />
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-[oklch(0.9_0.02_290)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Other monthly charges</h3>
            <p className="text-xs text-muted-foreground">
              Add extra columns on the ledger (for example Office Rent).
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setForm((p) => ({
                ...p,
                line_items: [...p.line_items, { label: "", amount: "" }],
              }))
            }
          >
            Add other
          </Button>
        </div>
        {form.line_items.map((item, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <Input
              placeholder="Label"
              value={item.label}
              onChange={(e) =>
                setForm((p) => {
                  const next = [...p.line_items];
                  next[index] = { ...next[index]!, label: e.target.value };
                  return { ...p, line_items: next };
                })
              }
            />
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="Amount"
              value={item.amount}
              onChange={(e) =>
                setForm((p) => {
                  const next = [...p.line_items];
                  next[index] = { ...next[index]!, amount: e.target.value };
                  return { ...p, line_items: next };
                })
              }
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  line_items: p.line_items.filter((_, i) => i !== index),
                }))
              }
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      <DocumentFileField
        id="agreement_file"
        label="Agreement file"
        existingPath={editing?.agreement_file_url ?? null}
        onFileChange={setAgreementFile}
        onView={
          editing?.agreement_file_url
            ? () =>
                void openTenantDocument(`/api/tenants/${editing.id}/agreement`)
            : undefined
        }
        onRemove={
          editing?.agreement_file_url
            ? async () => {
                setRemovingAgreement(true);
                try {
                  await apiFetch(`/api/tenants/${editing.id}/agreement`, {
                    method: "DELETE",
                  });
                  router.refresh();
                } finally {
                  setRemovingAgreement(false);
                }
              }
            : undefined
        }
        removing={removingAgreement}
      />

      {editing && paymentCount > 0 ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={regenerate}
            onChange={(e) => setRegenerate(e.target.checked)}
          />
          <span>
            Rebuild the monthly ledger from these dates and rent terms. This
            tenant already has {paymentCount} payment
            {paymentCount === 1 ? "" : "s"}; months that drop off the contract
            will lose those payments.
          </span>
        </label>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
