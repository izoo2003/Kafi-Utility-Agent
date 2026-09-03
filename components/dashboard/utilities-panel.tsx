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
  UTILITY_MENU_OPTIONS,
  providerByKey,
  providerByLabel,
  providersForMenu,
  type SiteUtilityProvider,
  type UtilityMenuKey,
} from "@/lib/utilities/providers";
import {
  billStatus,
  latestPayment,
  nextDueFromLastPaid,
} from "@/lib/utilities/billing";
import { UtilityBillSummary } from "@/components/dashboard/utility-bill-summary";
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
  units_kwh: string;
  bill_period: string;
  invoice_number: string;
  notes: string;
  file: File | null;
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
  units_kwh: "",
  bill_period: "",
  invoice_number: "",
  notes: "",
  file: null,
});

function fileNameFromPath(path: string) {
  const part = path.split("/").pop() ?? path;
  return part.replace(/^\d+-/, "");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatUnits(
  units: number | null | undefined,
  utilityType: string | undefined,
  menuKey?: string,
) {
  if (units == null) return "—";
  const n = Number(units);
  if (utilityType === "gas") return `${n} CM`;
  if (utilityType === "electricity") return `${n} kWh`;
  if (menuKey === "water-tanker") return `${n} tankers`;
  return String(n);
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

/** Exact provider label match only — never collapse all electricity into one row. */
function accountForProvider(
  items: UtilityAccount[],
  provider: SiteUtilityProvider,
): UtilityAccount | null {
  const matches = items.filter((item) => {
    const byLabel = providerByLabel(item.provider);
    return byLabel?.key === provider.key;
  });
  if (matches.length) {
    return (
      [...matches].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ??
      null
    );
  }

  // Exact label fallback (seeded rows)
  const byExact = items.filter(
    (i) =>
      i.provider?.trim().toLowerCase() === provider.label.toLowerCase(),
  );
  if (byExact.length) {
    return (
      [...byExact].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ??
      null
    );
  }

  // Unique non-electricity types only (Jazz is internet — no type fallback)
  const sameMenu = providersForMenu(provider.menuKey);
  if (sameMenu.length === 1 && provider.utility_type !== "internet") {
    const byType = items.filter(
      (i) => i.utility_type === provider.utility_type,
    );
    if (byType.length === 1) {
      return (
        [...byType].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ??
        null
      );
    }
  }

  return null;
}

function SiteBillSection({
  provider,
  account,
  payments,
  ensuringKey,
  onLogPayment,
  onEdit,
  onEditPayment,
  onDeletePayment,
  onPaymentUpdated,
}: {
  provider: SiteUtilityProvider;
  account: UtilityAccount | null;
  payments: UtilityPaymentLog[];
  ensuringKey: string | null;
  onLogPayment: () => void;
  onEdit: () => void;
  onEditPayment: (log: UtilityPaymentLog) => void;
  onDeletePayment: (id: string) => Promise<void>;
  onPaymentUpdated: (log: UtilityPaymentLog) => void;
}) {
  const title = provider.siteLabel ?? provider.label;
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
  const busy = ensuringKey === provider.key;

  return (
    <section className="space-y-4">
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
              <h2 className="text-lg font-medium">{title}</h2>
              <Badge variant="secondary">{provider.utility_type}</Badge>
              <span
                className={cn(
                  "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                  badge.className,
                )}
              >
                {badge.label}
              </span>
            </div>
            {provider.menuKey === "k-electric" ? (
              <p className="text-sm text-muted-foreground">
                K-Electric bill records for this location.
              </p>
            ) : provider.menuKey === "ssgc" ? (
              <p className="text-sm text-muted-foreground">
                SSGC gas bill records for this location.
              </p>
            ) : provider.menuKey === "kwsb" ? (
              <p className="text-sm text-muted-foreground">
                KWSB water board bill records for this location.
              </p>
            ) : provider.menuKey === "water-tanker" ? (
              <p className="text-sm text-muted-foreground">
                Water tanker delivery records for this location.
              </p>
            ) : provider.menuKey === "drinking-water" ? (
              <p className="text-sm text-muted-foreground">
                Drinking water records for this location.
              </p>
            ) : provider.menuKey === "ptcl" ? (
              <p className="text-sm text-muted-foreground">
                PTCL bill records for this location — add payments via chat or Log payment.
              </p>
            ) : provider.menuKey === "jazz" ? (
              <p className="text-sm text-muted-foreground">
                Jazz mobile bill records for this person.
              </p>
            ) : null}
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
            <Button onClick={onLogPayment} disabled={busy}>
              {busy ? "Preparing…" : "Log payment"}
            </Button>
            {account ? (
              <Button variant="outline" onClick={onEdit}>
                Edit details
              </Button>
            ) : null}
          </div>
        </div>

      <div className="grid gap-3 sm:grid-cols-4">
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
          <div>
            <p className="text-xs text-muted-foreground">Last units</p>
            <p className="text-sm font-medium">
              {formatUnits(last?.units_kwh, provider.utility_type, provider.menuKey)}
            </p>
          </div>
        </div>
      </div>

      <UtilityBillSummary
        account={account}
        provider={provider}
        payments={accountPayments}
        onPaymentUpdated={onPaymentUpdated}
      />

      <div className="space-y-3">
        <h3 className="text-base font-medium">Payment history — {title}</h3>
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[16%]">Paid on</TableHead>
                <TableHead className="w-[16%]">Next due</TableHead>
                <TableHead className="w-[14%]">Units</TableHead>
                <TableHead className="w-[16%]">Amount</TableHead>
                <TableHead className="w-[22%]">Bill / notes</TableHead>
                <TableHead className="w-[16%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!account || accountPayments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No payments for {title} yet. Use Log payment after each
                    bill is paid (or import a bill in chat).
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
                        {formatUnits(log.units_kwh, provider.utility_type, provider.menuKey)}
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
                      <CellText>
                        {[
                          log.bill_period,
                          log.invoice_number
                            ? `Inv ${log.invoice_number}`
                            : null,
                          log.bill_file_url
                            ? fileNameFromPath(log.bill_file_url)
                            : null,
                          log.notes,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </CellText>
                    </TableCell>
                    <TableCell className="max-w-none">
                      <TableActions>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onEditPayment(log)}
                        >
                          Edit
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={async () => {
                            await onDeletePayment(log.id);
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
      </div>
    </section>
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
  const [menuKey, setMenuKey] = useState<UtilityMenuKey>("k-electric");

  const [activeProviderKey, setActiveProviderKey] = useState<string | null>(
    null,
  );
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccount);

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState<PayForm>(emptyPay);
  const [editingPayment, setEditingPayment] =
    useState<UtilityPaymentLog | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ensuringKey, setEnsuringKey] = useState<string | null>(null);

  const menuProviders = useMemo(
    () => providersForMenu(menuKey),
    [menuKey],
  );
  const activeProvider = activeProviderKey
    ? providerByKey(activeProviderKey)
    : null;
  const activeAccount = activeProvider
    ? accountForProvider(items, activeProvider)
    : null;

  async function ensureAccount(
    provider: SiteUtilityProvider,
  ): Promise<UtilityAccount | null> {
    const existing = accountForProvider(items, provider);
    if (existing) return existing;
    setEnsuringKey(provider.key);
    setError(null);
    try {
      const data = await apiFetch<UtilityAccount>("/api/utilities", {
        method: "POST",
        body: JSON.stringify({
          utility_type: provider.utility_type,
          provider: provider.label,
          billing_cycle: provider.billing_cycle,
          notes: `Site ${provider.label} bill. Next due = last paid + 1 month.`,
        }),
      });
      setItems((prev) => upsertById(prev, data));
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account");
      return null;
    } finally {
      setEnsuringKey(null);
    }
  }

  function openEdit(provider: SiteUtilityProvider) {
    const account = accountForProvider(items, provider);
    if (!account) return;
    setActiveProviderKey(provider.key);
    setAccountForm({
      account_number: account.account_number ?? "",
      monthly_avg_cost:
        account.monthly_avg_cost == null
          ? ""
          : String(account.monthly_avg_cost),
      contact_person: account.contact_person ?? "",
      notes: account.notes ?? "",
    });
    setError(null);
    setAccountOpen(true);
  }

  async function openPay(provider: SiteUtilityProvider) {
    setActiveProviderKey(provider.key);
    const acct = await ensureAccount(provider);
    if (!acct) return;
    setEditingPayment(null);
    setPayForm({
      paid_on: todayIso(),
      amount:
        acct.monthly_avg_cost == null ? "" : String(acct.monthly_avg_cost),
      units_kwh: "",
      bill_period: "",
      invoice_number: "",
      notes: "",
      file: null,
    });
    setError(null);
    setPayOpen(true);
  }

  function openEditPayment(
    provider: SiteUtilityProvider,
    log: UtilityPaymentLog,
  ) {
    setActiveProviderKey(provider.key);
    setEditingPayment(log);
    setPayForm({
      paid_on: log.paid_on,
      amount: log.amount == null ? "" : String(log.amount),
      units_kwh: log.units_kwh == null ? "" : String(log.units_kwh),
      bill_period: log.bill_period ?? "",
      invoice_number: log.invoice_number ?? "",
      notes: log.notes ?? "",
      file: null,
    });
    setError(null);
    setPayOpen(true);
  }

  async function saveAccount() {
    if (!activeProvider || !activeAccount) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        utility_type: activeAccount.utility_type as UtilityType,
        provider: activeProvider.label,
        billing_cycle: activeProvider.billing_cycle,
        account_number: accountForm.account_number,
        monthly_avg_cost:
          accountForm.monthly_avg_cost === ""
            ? null
            : Number(accountForm.monthly_avg_cost),
        contact_person: accountForm.contact_person,
        notes: accountForm.notes,
      };
      const data = await apiFetch<UtilityAccount>(
        `/api/utilities/${activeAccount.id}`,
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
    if (!activeProvider) {
      setError("No utility selected.");
      return;
    }
    if (!payForm.paid_on) {
      setError("Paid date is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        paid_on: payForm.paid_on,
        amount: payForm.amount === "" ? null : Number(payForm.amount),
        units_kwh:
          payForm.units_kwh === "" ? null : Number(payForm.units_kwh),
        bill_period: payForm.bill_period || null,
        invoice_number: payForm.invoice_number || null,
        notes: payForm.notes,
      };

      let saved: UtilityPaymentLog;
      if (editingPayment) {
        saved = await apiFetch<UtilityPaymentLog>(
          `/api/utilities/payments/${editingPayment.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      } else {
        const acct =
          accountForProvider(items, activeProvider) ??
          (await ensureAccount(activeProvider));
        if (!acct) {
          setError("Could not resolve utility account.");
          setSaving(false);
          return;
        }
        saved = await apiFetch<UtilityPaymentLog>("/api/utilities/payments", {
          method: "POST",
          body: JSON.stringify({
            utility_account_id: acct.id,
            ...payload,
          }),
        });
      }

      if (payForm.file) {
        const formData = new FormData();
        formData.append("file", payForm.file);
        const res = await fetch(`/api/utilities/payments/${saved.id}/upload`, {
          method: "POST",
          body: formData,
        });
        const json = (await res.json()) as {
          data?: UtilityPaymentLog;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? "Bill PDF upload failed");
        }
        if (json.data) saved = json.data;
      }

      setPayments((prev) =>
        editingPayment
          ? prev.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev],
      );
      if (payForm.amount !== "") {
        const acct = accountForProvider(items, activeProvider);
        if (acct) {
          const updated = await apiFetch<UtilityAccount>(
            `/api/utilities/${acct.id}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                monthly_avg_cost: Number(payForm.amount),
              }),
            },
          ).catch(() => null);
          if (updated) {
            setItems((prev) =>
              prev.map((i) => (i.id === updated.id ? updated : i)),
            );
          }
        }
      }
      setPayOpen(false);
      setEditingPayment(null);
      setPayForm(emptyPay());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save payment");
    } finally {
      setSaving(false);
    }
  }

  const dialogTitle =
    activeProvider?.siteLabel ?? activeProvider?.label ?? "Utility";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Internet & utilities"
          description="Pick a utility from the dropdown. K-Electric, water tanker, and other groups show each location separately. Next due = last paid + 1 month. Dates: DD/MM/YYYY."
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
          value={menuKey}
          onChange={(e) => {
            setMenuKey(e.target.value as UtilityMenuKey);
            setError(null);
          }}
        >
          {UTILITY_MENU_OPTIONS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {menuKey === "k-electric"
            ? "K-Electric: four sections below — 239G Mill, 234G Mill, Clifton Office, KMP House."
            : menuKey === "ssgc"
              ? "SSGC (Gas): two sections — Clifton Office and KMP House."
              : menuKey === "kwsb"
                ? "KWSB (Water Board): one section — Clifton Office only."
                : menuKey === "water-tanker"
                  ? "Water tanker: four sections — Home, Office, 239G Mill, 234G Mill."
                  : menuKey === "drinking-water"
                    ? "Drinking water: one section — Clifton Office."
                : menuKey === "ptcl"
                  ? "PTCL: two sections — Office and KMP House. Log bills via chat or Log payment."
                  : menuKey === "jazz"
                    ? "Jazz: two sections — Khalid Paracha and Sadia Paracha."
                    : "Showing one utility at a time — log payments for the selected provider."}
        </p>
      </div>

      {error && !payOpen && !accountOpen ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-10">
        {menuProviders.map((provider) => (
          <SiteBillSection
            key={provider.key}
            provider={provider}
            account={accountForProvider(items, provider)}
            payments={payments}
            ensuringKey={ensuringKey}
            onLogPayment={() => void openPay(provider)}
            onEdit={() => openEdit(provider)}
            onEditPayment={(log) => openEditPayment(provider, log)}
            onPaymentUpdated={(log) => {
              setPayments((prev) => upsertById(prev, log));
            }}
            onDeletePayment={async (id) => {
              await apiFetch(`/api/utilities/payments/${id}`, {
                method: "DELETE",
              });
              setPayments((prev) => prev.filter((p) => p.id !== id));
              router.refresh();
            }}
          />
        ))}
      </div>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {dialogTitle}</DialogTitle>
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

      <Dialog
        open={payOpen}
        onOpenChange={(open) => {
          setPayOpen(open);
          if (!open) {
            setEditingPayment(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPayment ? "Edit payment" : "Log payment"} — {dialogTitle}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Next due will be one month after this paid date. Include units from
            the KE bill when available.
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
            <div className="grid gap-3 sm:grid-cols-2">
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
                <Label>
                  {activeProvider?.menuKey === "water-tanker"
                    ? "Units (tankers, optional)"
                    : activeProvider?.utility_type === "gas"
                      ? "Units (CM, optional)"
                      : activeProvider?.utility_type === "electricity"
                        ? "Units (kWh, optional)"
                        : "Units (optional)"}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={payForm.units_kwh}
                  onChange={(e) =>
                    setPayForm((p) => ({ ...p, units_kwh: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bill period (e.g. Jul-26)</Label>
                <Input
                  value={payForm.bill_period}
                  onChange={(e) =>
                    setPayForm((p) => ({ ...p, bill_period: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice number</Label>
                <Input
                  value={payForm.invoice_number}
                  onChange={(e) =>
                    setPayForm((p) => ({
                      ...p,
                      invoice_number: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                {editingPayment
                  ? "Replace bill PDF (optional)"
                  : "Bill PDF (optional)"}
              </Label>
              <Input
                type="file"
                accept=".pdf,application/pdf,image/*"
                onChange={(e) =>
                  setPayForm((p) => ({
                    ...p,
                    file: e.target.files?.[0] ?? null,
                  }))
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
              {saving
                ? "Saving…"
                : editingPayment
                  ? "Update payment"
                  : "Save payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
