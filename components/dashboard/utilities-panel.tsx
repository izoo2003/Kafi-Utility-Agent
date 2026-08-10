"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UtilityAccount, UtilityType } from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { formatDateTime } from "@/lib/format/datetime";
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

type FormState = {
  utility_type: UtilityType;
  provider: string;
  account_number: string;
  billing_cycle: string;
  monthly_avg_cost: string;
  due_date_day: string;
  contact_person: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  utility_type: "internet",
  provider: "",
  account_number: "",
  billing_cycle: "",
  monthly_avg_cost: "",
  due_date_day: "",
  contact_person: "",
  notes: "",
});

export function UtilitiesPanel({
  initialItems,
}: {
  initialItems: UtilityAccount[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UtilityAccount | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.utility_type.localeCompare(b.utility_type),
      ),
    [items],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(item: UtilityAccount) {
    setEditing(item);
    setForm({
      utility_type: item.utility_type,
      provider: item.provider ?? "",
      account_number: item.account_number ?? "",
      billing_cycle: item.billing_cycle ?? "",
      monthly_avg_cost:
        item.monthly_avg_cost == null ? "" : String(item.monthly_avg_cost),
      due_date_day:
        item.due_date_day == null ? "" : String(item.due_date_day),
      contact_person: item.contact_person ?? "",
      notes: item.notes ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        utility_type: form.utility_type,
        provider: form.provider,
        account_number: form.account_number,
        billing_cycle: form.billing_cycle,
        monthly_avg_cost:
          form.monthly_avg_cost === "" ? null : Number(form.monthly_avg_cost),
        due_date_day:
          form.due_date_day === "" ? null : Number(form.due_date_day),
        contact_person: form.contact_person,
        notes: form.notes,
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
        setItems((prev) => [...prev, data]);
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
          title="Utilities"
          description="Internet and utility accounts. Never store passwords here — use a password-manager entry name in notes if needed."
          icon="utilities"
          accent="emerald"
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
              <TableHead className="w-[12%]">Type</TableHead>
              <TableHead className="w-[16%]">Provider</TableHead>
              <TableHead className="w-[14%]">Account #</TableHead>
              <TableHead className="w-[10%]">Due day</TableHead>
              <TableHead className="w-[10%]">Avg cost</TableHead>
              <TableHead className="w-[12%]">Contact</TableHead>
              <TableHead className="w-[14%]">Updated</TableHead>
              <TableHead className="w-[12%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="max-w-none py-8 text-center text-muted-foreground"
                >
                  No utility accounts yet.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="secondary">{item.utility_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <CellPrimary
                      title={item.provider ?? "—"}
                      subtitle={item.billing_cycle}
                    />
                  </TableCell>
                  <TableCell>
                    <CellText>{item.account_number ?? "—"}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>
                      {item.due_date_day == null
                        ? "—"
                        : `Day ${item.due_date_day}`}
                    </CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>{item.monthly_avg_cost ?? "—"}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText>{item.contact_person ?? "—"}</CellText>
                  </TableCell>
                  <TableCell>
                    <CellText title={item.updated_at}>
                      {formatDateTime(item.updated_at)}
                    </CellText>
                  </TableCell>
                  <TableCell className="max-w-none">
                    <TableActions>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </Button>
                      <ConfirmDeleteButton
                        onConfirm={async () => {
                          await apiFetch(`/api/utilities/${item.id}`, {
                            method: "DELETE",
                          });
                          setItems((prev) =>
                            prev.filter((i) => i.id !== item.id),
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit utility account" : "Add utility account"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="utility_type">Utility type</Label>
              <select
                id="utility_type"
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={form.utility_type}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    utility_type: e.target.value as UtilityType,
                  }))
                }
              >
                <option value="internet">internet</option>
                <option value="electricity">electricity</option>
                <option value="gas">gas</option>
                <option value="water">water</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Input
                id="provider"
                value={form.provider}
                onChange={(e) =>
                  setForm((p) => ({ ...p, provider: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_number">Account number</Label>
              <Input
                id="account_number"
                value={form.account_number}
                onChange={(e) =>
                  setForm((p) => ({ ...p, account_number: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_cycle">Billing cycle</Label>
              <Input
                id="billing_cycle"
                placeholder="monthly, quarterly…"
                value={form.billing_cycle}
                onChange={(e) =>
                  setForm((p) => ({ ...p, billing_cycle: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_avg_cost">Monthly avg cost</Label>
              <Input
                id="monthly_avg_cost"
                type="number"
                min="0"
                step="any"
                value={form.monthly_avg_cost}
                onChange={(e) =>
                  setForm((p) => ({ ...p, monthly_avg_cost: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date_day">Due date day (1–31)</Label>
              <Input
                id="due_date_day"
                type="number"
                min="1"
                max="31"
                value={form.due_date_day}
                onChange={(e) =>
                  setForm((p) => ({ ...p, due_date_day: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact_person">Contact person</Label>
              <Input
                id="contact_person"
                value={form.contact_person}
                onChange={(e) =>
                  setForm((p) => ({ ...p, contact_person: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Password manager entry name only — never paste passwords"
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
