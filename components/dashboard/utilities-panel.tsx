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
  CellPrimary,
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
  type SiteUtilityProviderKey,
} from "@/lib/utilities/providers";
import {
  billStatus,
  latestPayment,
  nextDueFromLastPaid,
} from "@/lib/utilities/billing";
import { cn } from "@/lib/utils";

type AccountForm = {
  providerKey: SiteUtilityProviderKey | "";
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
  providerKey: "",
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

  const [accountOpen, setAccountOpen] = useState(false);
  const [editing, setEditing] = useState<UtilityAccount | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccount);

  const [payOpen, setPayOpen] = useState(false);
  const [payAccount, setPayAccount] = useState<UtilityAccount | null>(null);
  const [payForm, setPayForm] = useState<PayForm>(emptyPay);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAccount, setHistoryAccount] = useState<UtilityAccount | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const paymentsByAccount = useMemo(() => {
    const map = new Map<string, UtilityPaymentLog[]>();
    for (const p of payments) {
      const list = map.get(p.utility_account_id) ?? [];
      list.push(p);
      map.set(p.utility_account_id, list);
    }
    return map;
  }, [payments]);

  const rows = useMemo(() => {
    const today = todayIso();
    const order = new Map(
      SITE_UTILITY_PROVIDERS.map((p, i) => [p.label.toLowerCase(), i]),
    );
    return [...items]
      .map((account) => {
        const last = latestPayment(paymentsByAccount.get(account.id) ?? []);
        const nextDue = last ? nextDueFromLastPaid(last.paid_on) : null;
        const status = billStatus(nextDue, today);
        return { account, last, nextDue, status };
      })
      .sort((a, b) => {
        const ai =
          order.get((a.account.provider ?? "").toLowerCase()) ?? 99;
        const bi =
          order.get((b.account.provider ?? "").toLowerCase()) ?? 99;
        return ai - bi;
      });
  }, [items, paymentsByAccount]);

  const sortedForPage = useMemo(
    () => rows.map((r) => r.account),
    [rows],
  );
  // page over composed rows, not raw accounts
  const { page, setPage, pageRows: pageAccounts, total } =
    usePagedRows(sortedForPage);
  const pageRows = useMemo(() => {
    const ids = new Set(pageAccounts.map((a) => a.id));
    return rows.filter((r) => ids.has(r.account.id));
  }, [pageAccounts, rows]);

  const historyLogs = useMemo(() => {
    if (!historyAccount) return [];
    return sortNewestFirst(
      (paymentsByAccount.get(historyAccount.id) ?? []).map((p) => ({
        ...p,
        created_at: p.created_at,
      })),
    ).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  }, [historyAccount, paymentsByAccount]);

  function openCreate() {
    setEditing(null);
    setAccountForm(emptyAccount());
    setError(null);
    setAccountOpen(true);
  }

  function openEdit(item: UtilityAccount) {
    const match = SITE_UTILITY_PROVIDERS.find(
      (p) =>
        p.label.toLowerCase() === (item.provider ?? "").toLowerCase() ||
        p.utility_type === item.utility_type,
    );
    setEditing(item);
    setAccountForm({
      providerKey: (match?.key ?? "") as SiteUtilityProviderKey | "",
      account_number: item.account_number ?? "",
      monthly_avg_cost:
        item.monthly_avg_cost == null ? "" : String(item.monthly_avg_cost),
      contact_person: item.contact_person ?? "",
      notes: item.notes ?? "",
    });
    setError(null);
    setAccountOpen(true);
  }

  function openPay(account: UtilityAccount) {
    setPayAccount(account);
    setPayForm({
      paid_on: todayIso(),
      amount:
        account.monthly_avg_cost == null
          ? ""
          : String(account.monthly_avg_cost),
      notes: "",
    });
    setError(null);
    setPayOpen(true);
  }

  async function saveAccount() {
    if (!accountForm.providerKey && !editing) {
      setError("Select a utility from the dropdown.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const provider = accountForm.providerKey
        ? providerByKey(accountForm.providerKey)
        : null;
      const payload = {
        utility_type: (provider?.utility_type ??
          editing?.utility_type ??
          "internet") as UtilityType,
        provider: provider?.label ?? editing?.provider ?? "",
        billing_cycle: provider?.billing_cycle ?? "monthly",
        account_number: accountForm.account_number,
        monthly_avg_cost:
          accountForm.monthly_avg_cost === ""
            ? null
            : Number(accountForm.monthly_avg_cost),
        contact_person: accountForm.contact_person,
        notes: accountForm.notes,
      };
      if (editing) {
        const data = await apiFetch<UtilityAccount>(
          `/api/utilities/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<UtilityAccount>("/api/utilities", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setItems((prev) => upsertById(prev, data));
      }
      setAccountOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function savePayment() {
    if (!payAccount || !payForm.paid_on) {
      setError("Paid date is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<UtilityPaymentLog>("/api/utilities/payments", {
        method: "POST",
        body: JSON.stringify({
          utility_account_id: payAccount.id,
          paid_on: payForm.paid_on,
          amount: payForm.amount === "" ? null : Number(payForm.amount),
          notes: payForm.notes,
        }),
      });
      setPayments((prev) => [data, ...prev]);
      if (payForm.amount !== "") {
        setItems((prev) =>
          prev.map((a) =>
            a.id === payAccount.id
              ? { ...a, monthly_avg_cost: Number(payForm.amount) }
              : a,
          ),
        );
      }
      setPayOpen(false);
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
          description="K-Electric, PTCL, SSGC, KWSB, and Jazz — log each payment; next due is one month later. Dates: DD/MM/YYYY."
          icon="utilities"
          accent="slate"
        />
        <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
          <ExportButtons resource="utilities" />
          <Button onClick={openCreate}>Add account</Button>
        </div>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">Utility</TableHead>
              <TableHead className="w-[12%]">Type</TableHead>
              <TableHead className="w-[14%]">Last paid</TableHead>
              <TableHead className="w-[14%]">Next due</TableHead>
              <TableHead className="w-[12%]">Status</TableHead>
              <TableHead className="w-[12%]">Amount</TableHead>
              <TableHead className="w-[18%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="max-w-none py-8 text-center text-muted-foreground"
                >
                  No utility accounts yet. Run the latest migration, then refresh.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map(({ account, last, nextDue, status }) => {
                const badge = statusBadge(status);
                return (
                  <TableRow key={account.id}>
                    <TableCell>
                      <CellPrimary
                        title={account.provider ?? "—"}
                        subtitle={
                          account.account_number
                            ? `#${account.account_number}`
                            : null
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{account.utility_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {last ? formatDate(last.paid_on) : "—"}
                      </CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {nextDue ? formatDate(nextDue) : "—"}
                      </CellText>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {last?.amount != null
                          ? formatMoney(Number(last.amount))
                          : account.monthly_avg_cost != null
                            ? formatMoney(Number(account.monthly_avg_cost))
                            : "—"}
                      </CellText>
                    </TableCell>
                    <TableCell className="max-w-none">
                      <TableActions>
                        <Button
                          size="sm"
                          onClick={() => openPay(account)}
                        >
                          Log payment
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setHistoryAccount(account);
                            setHistoryOpen(true);
                          }}
                        >
                          History
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(account)}
                        >
                          Edit
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={async () => {
                            await apiFetch(`/api/utilities/${account.id}`, {
                              method: "DELETE",
                            });
                            setItems((prev) =>
                              prev.filter((i) => i.id !== account.id),
                            );
                            setPayments((prev) =>
                              prev.filter(
                                (p) => p.utility_account_id !== account.id,
                              ),
                            );
                            router.refresh();
                          }}
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
      <TablePagination total={total} page={page} onPageChange={setPage} />

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit utility account" : "Add utility account"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="provider">Utility</Label>
              <select
                id="provider"
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={accountForm.providerKey}
                disabled={Boolean(editing)}
                onChange={(e) =>
                  setAccountForm((p) => ({
                    ...p,
                    providerKey: e.target.value as SiteUtilityProviderKey | "",
                  }))
                }
              >
                <option value="">Select utility…</option>
                {SITE_UTILITY_PROVIDERS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              {editing ? (
                <p className="text-xs text-muted-foreground">
                  Provider is fixed for site bills ({editing.provider}).
                </p>
              ) : null}
            </div>
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
            <DialogTitle>
              Log payment
              {payAccount?.provider ? ` — ${payAccount.provider}` : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Next due will be set to one month after this paid date.
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

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Payment history
              {historyAccount?.provider ? ` — ${historyAccount.provider}` : ""}
            </DialogTitle>
          </DialogHeader>
          {historyLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payments logged yet. Use Log payment to add the last paid bill.
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {historyLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{formatDate(log.paid_on)}</p>
                    <p className="text-xs text-muted-foreground">
                      Next due {formatDate(nextDueFromLastPaid(log.paid_on))}
                      {log.notes ? ` · ${log.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>
                      {log.amount == null
                        ? "—"
                        : formatMoney(Number(log.amount))}
                    </span>
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
                  </div>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
