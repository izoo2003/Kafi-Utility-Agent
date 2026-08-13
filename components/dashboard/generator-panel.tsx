"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  GeneratorCheckupStatus,
  GeneratorExpense,
  GeneratorFuelLog,
  GeneratorMaintenance,
} from "@/lib/types/database";
import {
  defaultNextServiceDue,
  nextDueFromMaintenanceRows,
} from "@/lib/generator/maintenance";
import { formatDate } from "@/lib/format/datetime";
import { apiFetch } from "@/lib/dashboard/api-client";
import { sortNewestFirst } from "@/lib/dashboard/sort";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ImportFilesButton } from "@/components/dashboard/import-files-button";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { GeneratorExpensesSection } from "@/components/dashboard/generator-expenses-section";
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

type MaintForm = {
  service_date: string;
  next_service_due: string;
  service_type: string;
  vendor: string;
  cost: string;
  notes: string;
  checkup_status: GeneratorCheckupStatus;
};

type FuelForm = {
  log_date: string;
  liters_added: string;
  running_hours: string;
  fuel_level_pct: string;
  cost: string;
  notes: string;
};

const emptyMaint = (): MaintForm => ({
  service_date: "",
  next_service_due: "",
  service_type: "Monthly checkup",
  vendor: "",
  cost: "",
  notes: "",
  checkup_status: "done",
});

const emptyFuel = (): FuelForm => ({
  log_date: "",
  liters_added: "",
  running_hours: "",
  fuel_level_pct: "",
  cost: "",
  notes: "",
});

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

export function GeneratorPanel({
  initialMaintenance,
  initialFuel,
  initialExpenses,
}: {
  initialMaintenance: GeneratorMaintenance[];
  initialFuel: GeneratorFuelLog[];
  initialExpenses: GeneratorExpense[];
}) {
  const router = useRouter();
  const [maintenance, setMaintenance] = useState(initialMaintenance);
  const [fuel, setFuel] = useState(initialFuel);

  const [maintOpen, setMaintOpen] = useState(false);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [editingMaint, setEditingMaint] =
    useState<GeneratorMaintenance | null>(null);
  const [editingFuel, setEditingFuel] = useState<GeneratorFuelLog | null>(null);
  const [maintForm, setMaintForm] = useState<MaintForm>(emptyMaint);
  const [fuelForm, setFuelForm] = useState<FuelForm>(emptyFuel);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const maintSorted = useMemo(
    () => sortNewestFirst(maintenance),
    [maintenance],
  );
  const fuelSorted = useMemo(() => sortNewestFirst(fuel), [fuel]);

  const schedule = useMemo(
    () => nextDueFromMaintenanceRows(maintenance),
    [maintenance],
  );
  const nextDueHint = daysUntilLabel(schedule.nextDue);

  async function saveMaint() {
    setSaving(true);
    setError(null);
    try {
      const nextDue =
        maintForm.next_service_due ||
        (maintForm.service_date
          ? defaultNextServiceDue(maintForm.service_date)
          : null);
      const payload = {
        service_date: maintForm.service_date,
        next_service_due: nextDue,
        service_type: maintForm.service_type,
        vendor: maintForm.vendor,
        cost: maintForm.cost === "" ? null : Number(maintForm.cost),
        notes: maintForm.notes,
        checkup_status: maintForm.checkup_status,
      };
      if (editingMaint) {
        const data = await apiFetch<GeneratorMaintenance>(
          `/api/generator/maintenance/${editingMaint.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setMaintenance((prev) =>
          prev.map((i) => (i.id === data.id ? data : i)),
        );
      } else {
        const data = await apiFetch<GeneratorMaintenance>(
          "/api/generator/maintenance",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setMaintenance((prev) => [...prev, data]);
      }
      setMaintOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setCheckupStatus(
    row: GeneratorMaintenance,
    checkup_status: GeneratorCheckupStatus,
  ) {
    if (row.checkup_status === checkup_status) return;
    setStatusBusyId(row.id);
    setError(null);
    try {
      const data = await apiFetch<GeneratorMaintenance>(
        `/api/generator/maintenance/${row.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ checkup_status }),
        },
      );
      setMaintenance((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setStatusBusyId(null);
    }
  }

  async function saveFuel() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        log_date: fuelForm.log_date,
        liters_added:
          fuelForm.liters_added === "" ? null : Number(fuelForm.liters_added),
        running_hours:
          fuelForm.running_hours === ""
            ? null
            : Number(fuelForm.running_hours),
        fuel_level_pct:
          fuelForm.fuel_level_pct === ""
            ? null
            : Number(fuelForm.fuel_level_pct),
        cost: fuelForm.cost === "" ? null : Number(fuelForm.cost),
        notes: fuelForm.notes,
      };
      if (editingFuel) {
        const data = await apiFetch<GeneratorFuelLog>(
          `/api/generator/fuel/${editingFuel.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setFuel((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<GeneratorFuelLog>("/api/generator/fuel", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setFuel((prev) => [...prev, data]);
      }
      setFuelOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Generator"
        description="Monthly checkups, expenses (debit total), and fuel log. Dates: DD/MM/YYYY."
        icon="generator"
        accent="orange"
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">Maintenance</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons resource="generator-maintenance" />
            <ImportFilesButton target="generator-maintenance" />
            <Button
              onClick={() => {
                setEditingMaint(null);
                setMaintForm(emptyMaint());
                setError(null);
                setMaintOpen(true);
              }}
            >
              Log service
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-[oklch(0.88_0.03_55)] bg-[oklch(0.985_0.02_80)] px-4 py-3 sm:px-5">
          <p className="text-sm font-medium text-foreground">
            Next maintenance due:{" "}
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

        {error && !maintOpen && !fuelOpen ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[12%]">Service date</TableHead>
                <TableHead className="w-[12%]">Next due</TableHead>
                <TableHead className="w-[16%]">Status</TableHead>
                <TableHead className="w-[14%]">Type</TableHead>
                <TableHead className="w-[14%]">Vendor</TableHead>
                <TableHead className="w-[10%]">Cost</TableHead>
                <TableHead className="w-[22%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintSorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No maintenance records yet.
                  </TableCell>
                </TableRow>
              ) : (
                maintSorted.map((row) => (
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
                      <div className="inline-flex rounded-lg border border-[oklch(0.88_0.02_220)] p-0.5">
                        <button
                          type="button"
                          disabled={statusBusyId === row.id}
                          onClick={() => void setCheckupStatus(row, "done")}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                            row.checkup_status === "done"
                              ? "bg-[oklch(0.45_0.1_145)] text-white"
                              : "text-muted-foreground hover:bg-[oklch(0.96_0.01_220)]",
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
                              : "text-muted-foreground hover:bg-[oklch(0.96_0.01_220)]",
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
                          onClick={() => {
                            setEditingMaint(row);
                            setMaintForm({
                              service_date: row.service_date,
                              next_service_due: row.next_service_due ?? "",
                              service_type: row.service_type ?? "",
                              vendor: row.vendor ?? "",
                              cost: row.cost == null ? "" : String(row.cost),
                              notes: row.notes ?? "",
                              checkup_status: row.checkup_status ?? "done",
                            });
                            setError(null);
                            setMaintOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={async () => {
                            await apiFetch(
                              `/api/generator/maintenance/${row.id}`,
                              { method: "DELETE" },
                            );
                            setMaintenance((prev) =>
                              prev.filter((i) => i.id !== row.id),
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
      </section>

      <GeneratorExpensesSection initialExpenses={initialExpenses} />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">Fuel log</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons resource="generator-fuel" />
            <ImportFilesButton target="generator-fuel" />
            <Button
              onClick={() => {
                setEditingFuel(null);
                setFuelForm(emptyFuel());
                setError(null);
                setFuelOpen(true);
              }}
            >
              Log fuel
            </Button>
          </div>
        </div>
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[14%]">Date</TableHead>
                <TableHead className="w-[14%]">Liters</TableHead>
                <TableHead className="w-[16%]">Running hrs</TableHead>
                <TableHead className="w-[14%]">Level %</TableHead>
                <TableHead className="w-[14%]">Cost</TableHead>
                <TableHead className="w-[28%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fuelSorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No fuel logs yet.
                  </TableCell>
                </TableRow>
              ) : (
                fuelSorted.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <CellText>{formatDate(row.log_date)}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.liters_added ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.running_hours ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.fuel_level_pct ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.cost ?? "—"}</CellText>
                    </TableCell>
                    <TableCell className="max-w-none">
                      <TableActions>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingFuel(row);
                            setFuelForm({
                              log_date: row.log_date,
                              liters_added:
                                row.liters_added == null
                                  ? ""
                                  : String(row.liters_added),
                              running_hours:
                                row.running_hours == null
                                  ? ""
                                  : String(row.running_hours),
                              fuel_level_pct:
                                row.fuel_level_pct == null
                                  ? ""
                                  : String(row.fuel_level_pct),
                              cost: row.cost == null ? "" : String(row.cost),
                              notes: row.notes ?? "",
                            });
                            setError(null);
                            setFuelOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={async () => {
                            await apiFetch(`/api/generator/fuel/${row.id}`, {
                              method: "DELETE",
                            });
                            setFuel((prev) =>
                              prev.filter((i) => i.id !== row.id),
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
      </section>

      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMaint ? "Edit maintenance" : "Log maintenance"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Service date</Label>
              <Input
                type="date"
                value={maintForm.service_date}
                onChange={(e) => {
                  const service_date = e.target.value;
                  setMaintForm((p) => ({
                    ...p,
                    service_date,
                    next_service_due:
                      p.next_service_due || !service_date
                        ? p.next_service_due
                        : defaultNextServiceDue(service_date),
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Next service due</Label>
              <Input
                type="date"
                value={maintForm.next_service_due}
                onChange={(e) =>
                  setMaintForm((p) => ({
                    ...p,
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
              <div className="inline-flex rounded-lg border border-[oklch(0.88_0.02_220)] p-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setMaintForm((p) => ({ ...p, checkup_status: "done" }))
                  }
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    maintForm.checkup_status === "done"
                      ? "bg-[oklch(0.45_0.1_145)] text-white"
                      : "text-muted-foreground hover:bg-[oklch(0.96_0.01_220)]",
                  )}
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMaintForm((p) => ({ ...p, checkup_status: "not_done" }))
                  }
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    maintForm.checkup_status === "not_done"
                      ? "bg-[oklch(0.55_0.12_55)] text-white"
                      : "text-muted-foreground hover:bg-[oklch(0.96_0.01_220)]",
                  )}
                >
                  Not done
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Service type</Label>
              <Input
                value={maintForm.service_type}
                onChange={(e) =>
                  setMaintForm((p) => ({ ...p, service_type: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input
                value={maintForm.vendor}
                onChange={(e) =>
                  setMaintForm((p) => ({ ...p, vendor: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={maintForm.cost}
                onChange={(e) =>
                  setMaintForm((p) => ({ ...p, cost: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={maintForm.notes}
                onChange={(e) =>
                  setMaintForm((p) => ({ ...p, notes: e.target.value }))
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
            <Button variant="outline" onClick={() => setMaintOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveMaint}
              disabled={saving || !maintForm.service_date}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fuelOpen} onOpenChange={setFuelOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFuel ? "Edit fuel log" : "Log fuel"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Log date</Label>
              <Input
                type="date"
                value={fuelForm.log_date}
                onChange={(e) =>
                  setFuelForm((p) => ({ ...p, log_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Liters added</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={fuelForm.liters_added}
                onChange={(e) =>
                  setFuelForm((p) => ({ ...p, liters_added: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Running hours</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={fuelForm.running_hours}
                onChange={(e) =>
                  setFuelForm((p) => ({ ...p, running_hours: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Fuel level %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="any"
                value={fuelForm.fuel_level_pct}
                onChange={(e) =>
                  setFuelForm((p) => ({
                    ...p,
                    fuel_level_pct: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={fuelForm.cost}
                onChange={(e) =>
                  setFuelForm((p) => ({ ...p, cost: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={fuelForm.notes}
                onChange={(e) =>
                  setFuelForm((p) => ({ ...p, notes: e.target.value }))
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
            <Button variant="outline" onClick={() => setFuelOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveFuel}
              disabled={saving || !fuelForm.log_date}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
