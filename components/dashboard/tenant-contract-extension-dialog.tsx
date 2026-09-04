"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tenant, TenantRateType, TenantRentLineItem } from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { computeGrossRent } from "@/lib/tenants/ledger";
import { addDaysIso } from "@/lib/tenants/schedule";
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

type LineForm = { label: string; amount: string };

function numOrNull(value: string) {
  return value === "" ? null : Number(value);
}

export function TenantContractExtensionDialog({
  tenant,
  lineItems,
}: {
  tenant: Tenant;
  lineItems: TenantRentLineItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [extensionFrom, setExtensionFrom] = useState(() =>
    tenant.contract_end_date ? addDaysIso(tenant.contract_end_date, 1) : "",
  );
  const [extensionTill, setExtensionTill] = useState("");

  const [rentTermsChecked, setRentTermsChecked] = useState(false);
  const [rateType, setRateType] = useState<TenantRateType>(
    tenant.rate_type === "lum_sum" ? "lum_sum" : "per_sqft",
  );
  const [sqft, setSqft] = useState(tenant.sqft == null ? "" : String(tenant.sqft));
  const [rate, setRate] = useState(tenant.rate == null ? "" : String(tenant.rate));
  const [grossRent, setGrossRent] = useState(
    tenant.gross_rent == null ? "" : String(tenant.gross_rent),
  );

  const [chargesChecked, setChargesChecked] = useState(false);
  const [charges, setCharges] = useState<LineForm[]>(() =>
    lineItems.map((item) => ({ label: item.label, amount: String(item.amount ?? "") })),
  );

  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const autoGross = useMemo(
    () =>
      computeGrossRent({
        rate_type: rateType,
        sqft: numOrNull(sqft),
        rate: numOrNull(rate),
        gross_rent: numOrNull(grossRent),
      }),
    [rateType, sqft, rate, grossRent],
  );

  function reset() {
    setExtensionFrom(
      tenant.contract_end_date ? addDaysIso(tenant.contract_end_date, 1) : "",
    );
    setExtensionTill("");
    setRentTermsChecked(false);
    setRateType(tenant.rate_type === "lum_sum" ? "lum_sum" : "per_sqft");
    setSqft(tenant.sqft == null ? "" : String(tenant.sqft));
    setRate(tenant.rate == null ? "" : String(tenant.rate));
    setGrossRent(tenant.gross_rent == null ? "" : String(tenant.gross_rent));
    setChargesChecked(false);
    setCharges(
      lineItems.map((item) => ({ label: item.label, amount: String(item.amount ?? "") })),
    );
    setNotes("");
    setError(null);
  }

  async function save() {
    if (!extensionFrom || !extensionTill) {
      setError("Extension period (from and till) is required.");
      return;
    }
    if (extensionTill < extensionFrom) {
      setError("Extension till must be on or after extension from.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        extension_from: extensionFrom,
        extension_till: extensionTill,
        notes: notes.trim() || null,
        ...(rentTermsChecked
          ? {
              rent_terms: {
                rate_type: rateType,
                sqft: numOrNull(sqft),
                rate: numOrNull(rate),
                gross_rent: rateType === "per_sqft" ? autoGross : numOrNull(grossRent),
              },
            }
          : {}),
        ...(chargesChecked
          ? {
              line_items: charges
                .filter((item) => item.label.trim())
                .map((item) => ({
                  label: item.label.trim(),
                  amount: Number(item.amount || 0),
                })),
            }
          : {}),
      };
      await apiFetch(`/api/tenants/${tenant.id}/contract-extension`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Contract extension
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Contract extension — {tenant.tenant_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Existing ledger months are never changed. Pick the new period
              and check off what changed — only the checked items get new
              values; everything else carries over as-is.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="extension_from">Extension from</Label>
                <Input
                  id="extension_from"
                  type="date"
                  required
                  value={extensionFrom}
                  onChange={(e) => setExtensionFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extension_till">Extension till</Label>
                <Input
                  id="extension_till"
                  type="date"
                  required
                  value={extensionTill}
                  onChange={(e) => setExtensionTill(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-[oklch(0.9_0.02_290)] p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={rentTermsChecked}
                  onChange={(e) => setRentTermsChecked(e.target.checked)}
                />
                Rent terms changed (rate type / sqft / rate / gross rent)
              </label>
              {rentTermsChecked ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="ext_rate_type">Rate type</Label>
                    <select
                      id="ext_rate_type"
                      className="flex h-9 w-full rounded-lg border border-input bg-white px-3 text-sm"
                      value={rateType}
                      onChange={(e) => setRateType(e.target.value as TenantRateType)}
                    >
                      <option value="per_sqft">Per sqft (auto gross rent)</option>
                      <option value="lum_sum">Lum sum (flat monthly rent)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext_sqft">Sqft</Label>
                    <Input
                      id="ext_sqft"
                      type="number"
                      min="0"
                      step="any"
                      value={sqft}
                      onChange={(e) => setSqft(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext_rate">Rate</Label>
                    <Input
                      id="ext_rate"
                      type="number"
                      min="0"
                      step="any"
                      disabled={rateType === "lum_sum"}
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ext_gross_rent">Gross rent</Label>
                    <Input
                      id="ext_gross_rent"
                      type="number"
                      min="0"
                      step="any"
                      readOnly={rateType === "per_sqft"}
                      value={rateType === "per_sqft" ? (autoGross ?? "") : grossRent}
                      onChange={(e) => setGrossRent(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 rounded-lg border border-[oklch(0.9_0.02_290)] p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={chargesChecked}
                  onChange={(e) => setChargesChecked(e.target.checked)}
                />
                Other monthly charges changed
              </label>
              {chargesChecked ? (
                <div className="space-y-2">
                  {charges.map((item, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                      <Input
                        placeholder="Label"
                        value={item.label}
                        onChange={(e) =>
                          setCharges((prev) => {
                            const next = [...prev];
                            next[index] = { ...next[index]!, label: e.target.value };
                            return next;
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
                          setCharges((prev) => {
                            const next = [...prev];
                            next[index] = { ...next[index]!, amount: e.target.value };
                            return next;
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setCharges((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCharges((prev) => [...prev, { label: "", amount: "" }])
                    }
                  >
                    Add charge
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="extension_notes">Notes (optional)</Label>
              <Textarea
                id="extension_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Renewal agreement reference"
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
              {saving ? "Saving…" : "Save extension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
