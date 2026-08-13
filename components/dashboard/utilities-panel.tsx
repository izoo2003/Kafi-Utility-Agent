"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  UtilityAccount,
  UtilityPaymentLog,
  UtilityType,
} from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { sortNewestFirst, upsertById } from "@/lib/dashboard/sort";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { formatDate } from "@/lib/format/datetime";
import {
  CellText,
  TableActions,
  TableShell,
} from "@/components/dashboard/table-shell";
import { Badge } from "@/components/ui/badge";
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
import {
  SITE_UTILITY_PROVIDERS,
  providerByKey,
  providerByLabel,
  type SiteUtilityProviderKey,
} from "@/lib/utilities/providers";
import {
  billStatus,
  latestPayment,
  nextDueFromLastPaid,
} from "@/lib/utilities/billing";
import { cn } from "@/lib/utils";

type AccountForm = {
  account_number: string;
  monthly_avg_cost: string;
  contact_person: string;
  notes: string;
};

type PayForm = {
  paid_on: string;
  amount: string;
  notes: string;
};

const emptyAccount = (): AccountForm => ({
  account_number: "",
  monthly_avg_cost: "",
  contact_person: "",
  notes: "",
});

const emptyPay = (): PayForm => ({
  paid_on: "",
  amount: "",
  notes: "",
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function statusBadge(
  status: ReturnType<typeof billStatus>,
): { label: string; className: string } {
  switch (status) {
    case "overdue":
      return {
        label: "Overdue",
        className: "bg-[oklch(0.95_0.04_25)] text-[oklch(0.45_0.14_25)]",
      };
    case "due_today":
      return {
        label: "Due today",
        className: "bg-[oklch(0.95_0.04_25)] text-[oklch(0.45_0.14_25)]",
      };
    case "due_soon":
      return {
        label: "Due soon",
        className: "bg-[oklch(0.95_0.04_85)] text-[oklch(0.45_0.12_70)]",
      };
    case "ok":
      return {
        label: "Paid up",
        className: "bg-[oklch(0.95_0.03_155)] text-[oklch(0.4_0.1_155)]",
      };
    default:
      return {
        label: "No payment yet",
        className: "bg-muted text-muted-foreground",
      };
  }
}

/** Prefer exact provider label match; if duplicates, newest account. */
function accountForProvider(
  items: UtilityAccount[],
  key: SiteUtilityProviderKey,
): UtilityAccount | null {
  const provider = providerByKey(key);
  if (!provider) return null;
  const matches = items.filter((item) => {
    const byLabel = providerByLabel(item.provider);
    return byLabel?.key === key;
  });
  if (!matches.length) {
    // Fallback: type-only for unique types (not internet — PTCL + Jazz share it)
    if (provider.utility_type !== "internet") {
      const byType = items.filter(
        (i) => i.utility_type === provider.utility_type,
      );
      return (
        [...byType].sort((a, b) =>
          b.updated_at.localeCompare(a.updated_at),
        )[0] ?? null
      );
    }
    return null;
  }
  return (
    [...matches].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ??
    null
  );
}

export function UtilitiesPanel({
  initialItems,
  initialPayments,
}: {
  initialItems: UtilityAccount[];
  initialPayments: UtilityPaymentLog[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [payments, setPayments] = useState(initialPayments);
  const [selectedKey, setSelectedKey] = useState<SiteUtilityProviderKey>(
    SITE_UTILITY_PROVIDERS[0]!.key,
  );

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccount);

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState<PayForm>(emptyPay);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ensuring, setEnsuring] = useState(false);

  const selectedProvider = providerByKey(selectedKey)!;
  const account = useMemo(
    () => accountForProvider(items, selectedKey),
    [items, selectedKey],
  );

  const accountPayments = useMemo(() => {
    if (!account) return [];
    return sortNewestFirst(
      payments.filter((p) => p.utility_account_id === account.id),
    ).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  }, [payments, account]);

  const { page, setPage, pageRows, total } = usePagedRows(accountPayments);

  const last = latestPayment(accountPayments);
  const nextDue = last ? nextDueFromLastPaid(last.paid_on) : null;
  const status = billStatus(nextDue, todayIso());
  const badge = statusBadge(status);

  async function ensureSelectedAccount(): Promise<UtilityAccount | null> {
    if (account) return account;
    setEnsuring(true);
    setError(null);
    try {
      const data = await apiFetch<UtilityAccount>("/api/utilities", {
        method: "POST",
        body: JSON.stringify({
          utility_type: selectedProvider.utility_type,
          provider: selectedProvider.label,
          billing_cycle: selectedProvider.billing_cycle,
          notes: `Site ${selectedProvider.label} bill. Next due = last paid + 1 month.`,
        }),
      });
      setItems((prev) => upsertById(prev, data));
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account");
      return null;
    } finally {
      setEnsuring(false);
    }
  }

  function openEdit() {
    if (!account) return;
    setAccountForm({
      account_number: account.account_number ?? "",
      monthly_avg_cost:
        account.monthly_avg_cost == null ? "" : String(account.monthly_avg_cost),
      contact_person: account.contact_person ?? "",
      notes: account.notes ?? "",
    });
    setError(null);
    setAccountOpen(true);
  }

  async function openPay() {
    const acct = await ensureSelectedAccount();
    if (!acct) return;
    setPayForm({
      paid_on: todayIso(),
      amount:
        acct.monthly_avg_cost == null ? "" : String(acct.monthly_avg_cost),
      notes: "",
    });
    setError(null);
    setPayOpen(true);
  }

  async function saveAccount() {
    if (!account) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        utility_type: account.utility_type as UtilityType,
        provider: selectedProvider.label,
        billing_cycle: selectedProvider.billing_cycle,
        account_number: accountForm.account_number,
        monthly_avg_cost:
          accountForm.monthly_avg_cost === ""
            ? null
            : Number(accountForm.monthly_avg_cost),
        contact_person: accountForm.contact_person,
        notes: accountForm.notes,
      };
      const data = await apiFetch<UtilityAccount>(
        `/api/utilities/${account.id}`,
        { method: "PATCH", body: JSON.stringify(payload) },
      );
      setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      setAccountOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function savePayment() {
    const acct = account ?? (await ensureSelectedAccount());
    if (!acct || !payForm.paid_on) {
      setError("Paid date is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<UtilityPaymentLog>("/api/utilities/payments", {
        method: "POST",
        body: JSON.stringify({
          utility_account_id: acct.id,
          paid_on: payForm.paid_on,
          amount: payForm.amount === "" ? null : Number(payForm.amount),
          notes: payForm.notes,
        }),
      });
      setPayments((prev) => [data, ...prev]);
      if (payForm.amount !== "") {
        setItems((prev) =>
          prev.map((a) =>
            a.id === acct.id
              ? { ...a, monthly_avg_cost: Number(payForm.amount) }
              : a,
          ),
        );
      }
      setPayOpen(false);
      setPage(1);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Internet & utilities"
          description="Pick a utility from the dropdown, then log payments. Next due is one month after last paid. Dates: DD/MM/YYYY."
          icon="utilities"
          accent="slate"
        />
        <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
          <ExportButtons resource="utilities" />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-[oklch(0.88_0.02_220)] bg-[oklch(0.985_0.01_220)] px-4 py-4 sm:px-5">
        <Label htmlFor="utility-select">Utility</Label>
        <select
          id="utility-select"
          className="flex h-10 w-full max-w-md rounded-lg border border-input bg-white px-3 text-sm"
          value={selectedKey}
          onChange={(e) => {
            setSelectedKey(e.target.value as SiteUtilityProviderKey);
            setPage(1);
            setError(null);
          }}
        >
          {SITE_UTILITY_PROVIDERS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Showing one utility at a time — K-Electric, PTCL, SSGC, KWSB, or Jazz.
        </p>
      </div>

      <div
        className={cn(
          "space-y-3 rounded-xl border px-4 py-4 sm:px-5",
          status === "overdue" || status === "due_today"
            ? "border-[oklch(0.82_0.08_25)] bg-[oklch(0.97_0.02_25)]"
            : "border-[oklch(0.88_0.02_220)] bg-white/70",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">{selectedProvider.label}</h2>
              <Badge variant="secondary">{selectedProvider.utility_type}</Badge>
              <span
                className={cn(
                  "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                  badge.className,
                )}
              >
                {badge.label}
              </span>
            </div>
            {account?.account_number ? (
              <p className="text-sm text-muted-foreground">
                Account #{account.account_number}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {account
                  ? "No account number set — use Edit details if needed."
                  : "No record yet — Log payment will create it."}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void openPay()}
              disabled={ensuring || saving}
            >
              {ensuring ? "Preparing…" : "Log payment"}
            </Button>
            {account ? (
              <Button variant="outline" onClick={openEdit}>
                Edit details
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Last paid</p>
            <p className="text-sm font-medium">
              {last ? formatDate(last.paid_on) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Next due</p>
            <p className="text-sm font-medium">
              {nextDue ? formatDate(nextDue) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last amount</p>
            <p className="text-sm font-medium">
              {last?.amount != null
                ? formatMoney(Number(last.amount))
                : account?.monthly_avg_cost != null
                  ? formatMoney(Number(account.monthly_avg_cost))
                  : "—"}
            </p>
          </div>
        </div>
      </div>

      {error && !payOpen && !accountOpen ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-base font-medium">
          Payment history — {selectedProvider.label}
        </h3>
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Paid on</TableHead>
                <TableHead className="w-[25%]">Next due</TableHead>
                <TableHead className="w-[20%]">Amount</TableHead>
                <TableHead className="w-[20%]">Notes</TableHead>
                <TableHead className="w-[10%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!account || accountPayments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No payments for {selectedProvider.label} yet. Use Log
                    payment after each bill is paid.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <CellText>{formatDate(log.paid_on)}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {formatDate(nextDueFromLastPaid(log.paid_on))}
                      </CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {log.amount == null
                          ? "—"
                          : formatMoney(Number(log.amount))}
                      </CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{log.notes ?? "—"}</CellText>
                    </TableCell>
                    <TableCell className="max-w-none">
                      <TableActions>
                        <ConfirmDeleteButton
                          onConfirm={async () => {
                            await apiFetch(`/api/utilities/payments/${log.id}`, {
                              method: "DELETE",
                            });
                            setPayments((prev) =>
                              prev.filter((p) => p.id !== log.id),
                            );
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
        {account && accountPayments.length > 0 ? (
          <TablePagination total={total} page={page} onPageChange={setPage} />
        ) : null}
      </section>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {selectedProvider.label}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Account number</Label>
              <Input
                value={accountForm.account_number}
                onChange={(e) =>
                  setAccountForm((p) => ({
                    ...p,
                    account_number: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Typical amount</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={accountForm.monthly_avg_cost}
                onChange={(e) =>
                  setAccountForm((p) => ({
                    ...p,
                    monthly_avg_cost: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Contact</Label>
              <Input
                value={accountForm.contact_person}
                onChange={(e) =>
                  setAccountForm((p) => ({
                    ...p,
                    contact_person: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Password manager entry name only — never paste passwords"
                value={accountForm.notes}
                onChange={(e) =>
                  setAccountForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>
          </div>
          {error && accountOpen ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveAccount()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log payment — {selectedProvider.label}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Next due will be one month after this paid date.
          </p>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Paid on</Label>
              <Input
                type="date"
                value={payForm.paid_on}
                onChange={(e) =>
                  setPayForm((p) => ({ ...p, paid_on: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (optional)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={payForm.amount}
                onChange={(e) =>
                  setPayForm((p) => ({ ...p, amount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={payForm.notes}
                onChange={(e) =>
                  setPayForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>
          </div>
          {error && payOpen ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void savePayment()}
              disabled={saving || !payForm.paid_on}
            >
              {saving ? "Saving…" : "Save payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
