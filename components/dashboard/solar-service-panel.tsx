"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SolarCheckupStatus,
  SolarMaintenance,
} from "@/lib/types/database";
import type { SolarSitePublic } from "@/lib/sems/sites";
import {
  defaultNextServiceDue,
  nextDueFromMaintenanceRows,
} from "@/lib/generator/maintenance";
import { formatDate } from "@/lib/format/datetime";
import { solarSiteNavLabel } from "@/lib/dashboard/solar-site-nav";
import { apiFetch } from "@/lib/dashboard/api-client";
import { sortNewestFirst, upsertById } from "@/lib/dashboard/sort";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { useSolarSiteId } from "@/lib/dashboard/use-solar-site";
import { PageHeader } from "@/components/dashboard/page-header";
import { SolarSectionNav } from "@/components/dashboard/solar-section-nav";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ImportFilesButton } from "@/components/dashboard/import-files-button";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { TablePagination } from "@/components/dashboard/table-pagination";
import {
  CellText,
  TableActions,
  TableShell,
} from "@/components/dashboard/table-shell";
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
import { cn } from "@/lib/utils";

type ServiceForm = {
  service_date: string;
  next_service_due: string;
  service_type: string;
  vendor: string;
  cost: string;
  notes: string;
  checkup_status: SolarCheckupStatus;
};

const emptyForm = (): ServiceForm => ({
  service_date: "",
  next_service_due: "",
  service_type: "Service / maintenance",
  vendor: "",
  cost: "",
  notes: "",
  checkup_status: "done",
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntilLabel(iso: string | null): string | null {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  const days = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `in ${days} days`;
}

export function SolarServicePanel(props: {
  sites: SolarSitePublic[];
  initialSiteId: string;
  initialRows: SolarMaintenance[];
  /** When true, render only the table (for Solar → Records). */
  embedded?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <div className="h-48 animate-pulse rounded-xl border border-[oklch(0.9_0.02_185)] bg-[oklch(0.99_0.01_185)]" />
      }
    >
      <SolarServicePanelInner {...props} />
    </Suspense>
  );
}

function SolarServicePanelInner({
  sites,
  initialSiteId,
  initialRows,
  embedded = false,
}: {
  sites: SolarSitePublic[];
  initialSiteId: string;
  initialRows: SolarMaintenance[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const { siteId, site } = useSolarSiteId(sites, initialSiteId);
  const plantName = site ? solarSiteNavLabel(site.label) : "this plant";

  const [rows, setRows] = useState(initialRows);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SolarMaintenance | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const siteRows = useMemo(
    () => rows.filter((row) => row.site_id === siteId),
    [rows, siteId],
  );
  const sorted = useMemo(() => sortNewestFirst(siteRows), [siteRows]);
  const page = usePagedRows(sorted);
  const schedule = useMemo(
    () => nextDueFromMaintenanceRows(siteRows),
    [siteRows],
  );
  const nextDueHint = daysUntilLabel(schedule.nextDue);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        site_id: siteId,
        service_date: form.service_date,
        next_service_due:
          form.next_service_due ||
          (form.service_date ? defaultNextServiceDue(form.service_date) : null),
        service_type: form.service_type,
        vendor: form.vendor,
        cost: form.cost === "" ? null : Number(form.cost),
        notes: form.notes,
        checkup_status: form.checkup_status,
      };
      if (editing) {
        const data = await apiFetch<SolarMaintenance>(
          `/api/solar/maintenance/${editing.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setRows((prev) => prev.map((row) => (row.id === data.id ? data : row)));
      } else {
        const data = await apiFetch<SolarMaintenance>(
          "/api/solar/maintenance",
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

  async function setCheckupStatus(
    row: SolarMaintenance,
    checkup_status: SolarCheckupStatus,
  ) {
    if (row.checkup_status === checkup_status) return;
    setStatusBusyId(row.id);
    setError(null);
    try {
      const data = await apiFetch<SolarMaintenance>(
        `/api/solar/maintenance/${row.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ checkup_status }),
        },
      );
      setRows((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setStatusBusyId(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm(),
      service_date: todayIso(),
      next_service_due: defaultNextServiceDue(todayIso()),
    });
    setError(null);
    setOpen(true);
  }

  function openEdit(row: SolarMaintenance) {
    setEditing(row);
    setForm({
      service_date: row.service_date,
      next_service_due: row.next_service_due ?? "",
      service_type: row.service_type ?? "",
      vendor: row.vendor ?? "",
      cost: row.cost == null ? "" : String(row.cost),
      notes: row.notes ?? "",
      checkup_status: row.checkup_status ?? "done",
    });
    setError(null);
    setOpen(true);
  }

  const body = (
    <>
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            className={
              embedded
                ? "font-heading text-lg font-semibold"
                : "text-lg font-medium"
            }
          >
            Service logs
            {site ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {plantName}
              </span>
            ) : null}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons resource="solar-maintenance" />
            <ImportFilesButton target="solar-maintenance" />
            <Button onClick={openCreate} disabled={!siteId}>
              Log service
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-[oklch(0.88_0.03_185)] bg-[oklch(0.985_0.02_185)] px-4 py-3 sm:px-5">
          <p className="text-sm font-medium text-foreground">
            Next service due:{" "}
            {schedule.nextDue ? (
              <>
                {formatDate(schedule.nextDue)}
                {nextDueHint ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    ({nextDueHint})
                  </span>
                ) : null}
              </>
            ) : (
              <span className="font-normal text-muted-foreground">
                not scheduled yet
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Last done:{" "}
            {schedule.lastDoneDate ? formatDate(schedule.lastDoneDate) : "—"}
            {" · "}
            Cadence: about one checkup per month
            {schedule.pendingNotDone
              ? " · At least one checkup is still marked not done"
              : ""}
          </p>
        </div>

        {error && !open ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[14%]">Service date</TableHead>
                <TableHead className="w-[14%]">Next due</TableHead>
                <TableHead className="w-[14%]">Status</TableHead>
                <TableHead className="w-[16%]">Type</TableHead>
                <TableHead className="w-[14%]">Vendor</TableHead>
                <TableHead className="w-[10%]">Cost</TableHead>
                <TableHead className="w-[18%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No service records for {plantName} yet.
                  </TableCell>
                </TableRow>
              ) : (
                page.pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <CellText>{formatDate(row.service_date)}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {row.next_service_due
                          ? formatDate(row.next_service_due)
                          : "—"}
                      </CellText>
                    </TableCell>
                    <TableCell className="max-w-none">
                      <div className="inline-flex rounded-lg border border-[oklch(0.88_0.02_185)] p-0.5">
                        <button
                          type="button"
                          disabled={statusBusyId === row.id}
                          onClick={() => void setCheckupStatus(row, "done")}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                            row.checkup_status === "done"
                              ? "bg-[oklch(0.45_0.1_145)] text-white"
                              : "text-muted-foreground hover:bg-[oklch(0.96_0.01_185)]",
                          )}
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          disabled={statusBusyId === row.id}
                          onClick={() => void setCheckupStatus(row, "not_done")}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                            row.checkup_status === "not_done"
                              ? "bg-[oklch(0.55_0.12_55)] text-white"
                              : "text-muted-foreground hover:bg-[oklch(0.96_0.01_185)]",
                          )}
                        >
                          Not done
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.service_type ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.vendor ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.cost ?? "—"}</CellText>
                    </TableCell>
                    <TableCell className="max-w-none">
                      <TableActions>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={async () => {
                            await apiFetch(
                              `/api/solar/maintenance/${row.id}`,
                              { method: "DELETE" },
                            );
                            setRows((prev) =>
                              prev.filter((item) => item.id !== row.id),
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
        <TablePagination
          total={page.total}
          page={page.page}
          onPageChange={page.setPage}
        />
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit service" : `Log service · ${plantName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Service date</Label>
              <Input
                type="date"
                value={form.service_date}
                onChange={(e) => {
                  const service_date = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    service_date,
                    next_service_due:
                      prev.next_service_due || !service_date
                        ? prev.next_service_due
                        : defaultNextServiceDue(service_date),
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Next service due</Label>
              <Input
                type="date"
                value={form.next_service_due}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    next_service_due: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Defaults to one month after service date if left blank.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Checkup status</Label>
              <div className="inline-flex rounded-lg border border-[oklch(0.88_0.02_185)] p-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, checkup_status: "done" }))
                  }
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    form.checkup_status === "done"
                      ? "bg-[oklch(0.45_0.1_145)] text-white"
                      : "text-muted-foreground hover:bg-[oklch(0.96_0.01_185)]",
                  )}
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, checkup_status: "not_done" }))
                  }
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    form.checkup_status === "not_done"
                      ? "bg-[oklch(0.55_0.12_55)] text-white"
                      : "text-muted-foreground hover:bg-[oklch(0.96_0.01_185)]",
                  )}
                >
                  Not done
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Service type</Label>
              <Input
                value={form.service_type}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, service_type: e.target.value }))
                }
                placeholder="Cleaning, inverter check, …"
              />
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input
                value={form.vendor}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, vendor: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.cost}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, cost: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
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
            <Button
              onClick={() => void save()}
              disabled={saving || !form.service_date || !siteId}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) return body;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Solar · Service logs"
        description="Service logs and maintenance for each solar plant. Next due defaults to one month after the service date. Dates: DD/MM/YYYY."
        icon="solar"
        accent="teal"
      />
      <SolarSectionNav active="service" sites={sites} />
      {body}
    </div>
  );
}
