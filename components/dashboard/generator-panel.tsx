"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  GeneratorCheckupStatus,
  GeneratorFuelLog,
  GeneratorMaintenance,
  GeneratorRunLog,
  GeneratorVendor,
} from "@/lib/types/database";
import {
  generatorSectionMeta,
  type GeneratorSectionValue,
} from "@/lib/dashboard/generator-sections";
import {
  defaultNextServiceDue,
  nextDueFromMaintenanceRows,
} from "@/lib/generator/maintenance";
import {
  OIL_CHANGE_INTERVAL_HOURS,
  hoursBetween,
  hoursRunSinceOilChange,
  lastOilChangeRecord,
  oilChangeStatus,
} from "@/lib/generator/oil-change";
import { formatDate, formatDateTime } from "@/lib/format/datetime";
import {
  isIsoDateInRange,
  normalizeToIsoDate,
} from "@/lib/validations/helpers";
import { apiFetch } from "@/lib/dashboard/api-client";
import { sortNewestFirst, upsertById } from "@/lib/dashboard/sort";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { PageHeader } from "@/components/dashboard/page-header";
import { GeneratorSectionNav } from "@/components/dashboard/generator-section-nav";
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

type MaintForm = {
  service_date: string;
  next_service_due: string;
  service_type: string;
  vendor: string;
  cost: string;
  notes: string;
  checkup_status: GeneratorCheckupStatus;
  hour_meter: string;
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
  hour_meter: "",
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toDatetimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

function formatMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

type RunForm = {
  run_date: string;
  hours_run: string;
  started_at: string;
  ended_at: string;
  notes: string;
};

const emptyRun = (): RunForm => ({
  run_date: todayIso(),
  hours_run: "",
  started_at: "",
  ended_at: "",
  notes: "",
});

export function GeneratorPanel({
  section,
  initialMaintenance = [],
  initialFuel = [],
  initialRuns = [],
  initialVendors = [],
}: {
  section: Extract<GeneratorSectionValue, "maintenance" | "runs" | "fuel">;
  initialMaintenance?: GeneratorMaintenance[];
  initialFuel?: GeneratorFuelLog[];
  initialRuns?: GeneratorRunLog[];
  initialVendors?: GeneratorVendor[];
}) {
  const router = useRouter();
  const copy = generatorSectionMeta(section);
  const [maintenance, setMaintenance] = useState(initialMaintenance);
  const [fuel, setFuel] = useState(initialFuel);
  const [runs, setRuns] = useState(initialRuns);
  const vendorNames = useMemo(
    () =>
      [...initialVendors]
        .map((v) => v.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [initialVendors],
  );

  const [maintOpen, setMaintOpen] = useState(false);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<GeneratorRunLog | null>(null);
  const [runForm, setRunForm] = useState<RunForm>(emptyRun);
  const [editingMaint, setEditingMaint] =
    useState<GeneratorMaintenance | null>(null);
  const [editingFuel, setEditingFuel] = useState<GeneratorFuelLog | null>(null);
  const [maintForm, setMaintForm] = useState<MaintForm>(emptyMaint);
  const [fuelForm, setFuelForm] = useState<FuelForm>(emptyFuel);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [fuelDateFrom, setFuelDateFrom] = useState("");
  const [fuelDateTo, setFuelDateTo] = useState("");

  const maintSorted = useMemo(
    () => sortNewestFirst(maintenance),
    [maintenance],
  );
  const fuelFiltered = useMemo(() => {
    if (!fuelDateFrom && !fuelDateTo) return fuel;
    return fuel.filter((row) =>
      isIsoDateInRange(row.log_date, fuelDateFrom, fuelDateTo),
    );
  }, [fuel, fuelDateFrom, fuelDateTo]);
  const fuelSorted = useMemo(
    () => sortNewestFirst(fuelFiltered),
    [fuelFiltered],
  );
  const maintPage = usePagedRows(maintSorted);
  const fuelPage = usePagedRows(fuelSorted);
  const fuelRangeActive = Boolean(fuelDateFrom || fuelDateTo);
  const fuelTotalCost = useMemo(
    () => fuelFiltered.reduce((sum, r) => sum + (Number(r.cost) || 0), 0),
    [fuelFiltered],
  );
  const fuelDateSpan = useMemo(() => {
    const dates = fuel
      .map((r) => normalizeToIsoDate(r.log_date))
      .filter((d): d is string => Boolean(d))
      .sort();
    if (!dates.length) return null;
    return { min: dates[0]!, max: dates[dates.length - 1]! };
  }, [fuel]);

  const schedule = useMemo(
    () => nextDueFromMaintenanceRows(maintenance),
    [maintenance],
  );
  const nextDueHint = daysUntilLabel(schedule.nextDue);

  const oilInfo = useMemo(() => {
    const lastOil = lastOilChangeRecord(maintenance);
    const since = hoursRunSinceOilChange(
      runs,
      lastOil?.service_date ?? null,
    );
    const status = oilChangeStatus(since);
    return { lastOil, since, runCount: runs.length, ...status };
  }, [runs, maintenance]);

  const runsSorted = useMemo(() => sortNewestFirst(runs), [runs]);
  const runsPage = usePagedRows(runsSorted);

  async function saveMaint() {
    setSaving(true);
    setError(null);
    try {
      const isOilChange = /oil\s*change/i.test(maintForm.service_type);
      const nextDue = isOilChange
        ? maintForm.next_service_due || null
        : maintForm.next_service_due ||
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
        hour_meter:
          maintForm.hour_meter === "" ? null : Number(maintForm.hour_meter),
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
        setMaintenance((prev) => upsertById(prev, data));
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

  function syncRunHoursFromTimes(next: RunForm): RunForm {
    if (!next.started_at || !next.ended_at) return next;
    const hrs = hoursBetween(
      new Date(next.started_at).toISOString(),
      new Date(next.ended_at).toISOString(),
    );
    if (hrs == null) return next;
    return { ...next, hours_run: String(hrs) };
  }

  async function saveRun() {
    setSaving(true);
    setError(null);
    try {
      let hours = runForm.hours_run === "" ? NaN : Number(runForm.hours_run);
      if (
        (!Number.isFinite(hours) || hours <= 0) &&
        runForm.started_at &&
        runForm.ended_at
      ) {
        const calc = hoursBetween(
          new Date(runForm.started_at).toISOString(),
          new Date(runForm.ended_at).toISOString(),
        );
        if (calc != null) hours = calc;
      }
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new Error("Enter hours run, or start and end times.");
      }
      const payload = {
        run_date: runForm.run_date,
        hours_run: hours,
        started_at: runForm.started_at
          ? new Date(runForm.started_at).toISOString()
          : null,
        ended_at: runForm.ended_at
          ? new Date(runForm.ended_at).toISOString()
          : null,
        notes: runForm.notes,
      };
      if (editingRun) {
        const data = await apiFetch<GeneratorRunLog>(
          `/api/generator/runs/${editingRun.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setRuns((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<GeneratorRunLog>("/api/generator/runs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setRuns((prev) => upsertById(prev, data));
      }
      setRunOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
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
        setFuel((prev) => upsertById(prev, data));
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
        title={`Generator · ${copy.label}`}
        description={copy.pageDescription}
        icon="generator"
        accent="orange"
      />
      <GeneratorSectionNav active={section} />

      {section === "maintenance" ? (
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">Maintenance</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons resource="generator-maintenance" />
            <ImportFilesButton target="generator-maintenance" />
            <Button
              variant="outline"
              onClick={() => {
                setEditingMaint(null);
                setMaintForm({
                  ...emptyMaint(),
                  service_date: todayIso(),
                  service_type: "Oil change",
                  checkup_status: "done",
                  next_service_due: "",
                  hour_meter: "",
                });
                setError(null);
                setMaintOpen(true);
              }}
            >
              Log oil change
            </Button>
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

        <div
          className={cn(
            "rounded-xl border px-4 py-3 sm:px-5",
            oilInfo.due
              ? "border-[oklch(0.82_0.08_25)] bg-[oklch(0.97_0.02_25)]"
              : "border-[oklch(0.88_0.02_220)] bg-[oklch(0.985_0.01_220)]",
          )}
        >
          <p className="text-sm font-medium text-foreground">
            {oilInfo.due ? "Oil change needed" : "Oil change (outage hours)"}
            {" · "}
            every {OIL_CHANGE_INTERVAL_HOURS} h of generator run time
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Not live — when power fails and the generator runs, log that session
            below. Hours since last oil change: {oilInfo.since} h
            {oilInfo.lastOil
              ? ` (last oil change ${formatDate(oilInfo.lastOil.service_date)})`
              : " (no oil change logged yet)"}
            {!oilInfo.due && oilInfo.remaining != null
              ? ` · ~${oilInfo.remaining} h remaining`
              : null}
          </p>
          {oilInfo.due ? (
            <p className="mt-2 text-sm font-medium text-[oklch(0.45_0.14_25)]">
              Logged outage runs have reached {OIL_CHANGE_INTERVAL_HOURS}+ hours
              since the last oil change. Log an oil change when completed.
            </p>
          ) : null}
        </div>

        {error && !maintOpen && !fuelOpen && !runOpen ? (
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
                <TableHead className="w-[10%]">Hours</TableHead>
                <TableHead className="w-[14%]">Status</TableHead>
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
                    colSpan={8}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No maintenance records yet.
                  </TableCell>
                </TableRow>
              ) : (
                maintPage.pageRows.map((row) => (
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
                    <TableCell>
                      <CellText>
                        {row.hour_meter == null ? "—" : row.hour_meter}
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
                              hour_meter:
                                row.hour_meter == null
                                  ? ""
                                  : String(row.hour_meter),
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
        <TablePagination
          total={maintPage.total}
          page={maintPage.page}
          onPageChange={maintPage.setPage}
        />
      </section>
      ) : null}

      {section === "runs" ? (
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">Outage / generator runs</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons resource="generator-runs" />
            <ImportFilesButton target="generator-runs" />
            <Button
              onClick={() => {
                setEditingRun(null);
                setRunForm(emptyRun());
                setError(null);
                setRunOpen(true);
              }}
            >
              Log run
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          When the lights go out and the generator starts, log how long it ran.
          Those hours add up toward the {OIL_CHANGE_INTERVAL_HOURS} h oil change.
        </p>
        <div
          className={cn(
            "rounded-xl border px-4 py-3 sm:px-5",
            oilInfo.due
              ? "border-[oklch(0.82_0.08_25)] bg-[oklch(0.97_0.02_25)]"
              : "border-[oklch(0.88_0.02_220)] bg-[oklch(0.985_0.01_220)]",
          )}
        >
          <p className="text-sm font-medium text-foreground">
            {oilInfo.due ? "Oil change needed" : "Oil change (outage hours)"}
            {" · "}
            every {OIL_CHANGE_INTERVAL_HOURS} h of generator run time
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hours since last oil change: {oilInfo.since} h
            {oilInfo.lastOil
              ? ` (last oil change ${formatDate(oilInfo.lastOil.service_date)})`
              : " (no oil change logged yet)"}
            {!oilInfo.due && oilInfo.remaining != null
              ? ` · ~${oilInfo.remaining} h remaining`
              : null}
          </p>
        </div>
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[16%]">Date</TableHead>
                <TableHead className="w-[14%]">Hours run</TableHead>
                <TableHead className="w-[20%]">Started</TableHead>
                <TableHead className="w-[20%]">Ended</TableHead>
                <TableHead className="w-[14%]">Notes</TableHead>
                <TableHead className="w-[16%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsSorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No outage runs logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                runsPage.pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <CellText>{formatDate(row.run_date)}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.hours_run}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {row.started_at
                          ? formatDateTime(row.started_at)
                          : "—"}
                      </CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {row.ended_at ? formatDateTime(row.ended_at) : "—"}
                      </CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.notes ?? "—"}</CellText>
                    </TableCell>
                    <TableCell className="max-w-none">
                      <TableActions>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingRun(row);
                            setRunForm({
                              run_date: row.run_date,
                              hours_run: String(row.hours_run),
                              started_at: toDatetimeLocal(row.started_at),
                              ended_at: toDatetimeLocal(row.ended_at),
                              notes: row.notes ?? "",
                            });
                            setError(null);
                            setRunOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={async () => {
                            await apiFetch(`/api/generator/runs/${row.id}`, {
                              method: "DELETE",
                            });
                            setRuns((prev) =>
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
        <TablePagination
          total={runsPage.total}
          page={runsPage.page}
          onPageChange={runsPage.setPage}
        />
      </section>
      ) : null}

      {section === "fuel" ? (
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

        <div className="space-y-3 rounded-xl border border-[oklch(0.88_0.02_220)] bg-[oklch(0.985_0.01_220)] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="fuel-from" className="text-xs">
                From (log date)
              </Label>
              <Input
                id="fuel-from"
                type="date"
                value={fuelDateFrom}
                max={fuelDateTo || undefined}
                onChange={(e) => {
                  setFuelDateFrom(e.target.value);
                  fuelPage.setPage(1);
                }}
                className="w-full sm:w-[11.5rem]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fuel-to" className="text-xs">
                To (log date)
              </Label>
              <Input
                id="fuel-to"
                type="date"
                value={fuelDateTo}
                min={fuelDateFrom || undefined}
                onChange={(e) => {
                  setFuelDateTo(e.target.value);
                  fuelPage.setPage(1);
                }}
                className="w-full sm:w-[11.5rem]"
              />
            </div>
            {fuelRangeActive ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFuelDateFrom("");
                  setFuelDateTo("");
                  fuelPage.setPage(1);
                }}
              >
                Clear dates
              </Button>
            ) : null}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Total cost: {formatMoney(fuelTotalCost)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {fuelFiltered.length} row
              {fuelFiltered.length === 1 ? "" : "s"}
              {fuelRangeActive
                ? ` in range${fuelDateFrom ? ` from ${formatDate(fuelDateFrom)}` : ""}${fuelDateTo ? ` to ${formatDate(fuelDateTo)}` : ""}`
                : ""}{" "}
              · dates shown as DD/MM/YYYY
              {fuelRangeActive && fuelFiltered.length !== fuel.length
                ? ` · ${fuel.length} total`
                : ""}
            </p>
          </div>
        </div>

        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[14%]">Date</TableHead>
                <TableHead className="w-[14%]">Litres</TableHead>
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
                    {fuelRangeActive
                      ? fuelDateSpan
                        ? `No fuel logs in this date range. Existing logs span ${formatDate(fuelDateSpan.min)} – ${formatDate(fuelDateSpan.max)}.`
                        : "No fuel logs in this date range."
                      : "No fuel logs yet."}
                  </TableCell>
                </TableRow>
              ) : (
                fuelPage.pageRows.map((row) => (
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
                      <CellText>
                        {row.cost == null ? "—" : formatMoney(Number(row.cost))}
                      </CellText>
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
        <TablePagination
          total={fuelPage.total}
          page={fuelPage.page}
          onPageChange={fuelPage.setPage}
        />
      </section>
      ) : null}

      {section === "maintenance" ? (
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
              <Label>Hour meter</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={maintForm.hour_meter}
                onChange={(e) =>
                  setMaintForm((p) => ({ ...p, hour_meter: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Required for oil changes — reading when the service was done.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input
                list="generator-vendor-names"
                value={maintForm.vendor}
                onChange={(e) =>
                  setMaintForm((p) => ({ ...p, vendor: e.target.value }))
                }
                placeholder="Select or type a name"
              />
              <datalist id="generator-vendor-names">
                {vendorNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
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
      ) : null}

      {section === "runs" ? (
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRun ? "Edit generator run" : "Log generator run"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Use when power failed and the generator ran. Enter hours directly,
            or start/end times to calculate hours.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Run date</Label>
              <Input
                type="date"
                value={runForm.run_date}
                onChange={(e) =>
                  setRunForm((p) => ({ ...p, run_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Hours run</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={runForm.hours_run}
                onChange={(e) =>
                  setRunForm((p) => ({ ...p, hours_run: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Started (optional)</Label>
              <Input
                type="datetime-local"
                value={runForm.started_at}
                onChange={(e) =>
                  setRunForm((p) =>
                    syncRunHoursFromTimes({
                      ...p,
                      started_at: e.target.value,
                    }),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Ended (optional)</Label>
              <Input
                type="datetime-local"
                value={runForm.ended_at}
                onChange={(e) =>
                  setRunForm((p) =>
                    syncRunHoursFromTimes({
                      ...p,
                      ended_at: e.target.value,
                    }),
                  )
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="e.g. Area outage"
                value={runForm.notes}
                onChange={(e) =>
                  setRunForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>
          </div>
          {error && runOpen ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveRun()}
              disabled={saving || !runForm.run_date}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}

      {section === "fuel" ? (
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
      ) : null}
    </div>
  );
}
