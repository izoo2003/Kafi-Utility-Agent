"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SolarMonitoringLog, SolarSpecs } from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { sortNewestFirst, upsertById } from "@/lib/dashboard/sort";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { PageHeader } from "@/components/dashboard/page-header";
import { SolarSectionNav } from "@/components/dashboard/solar-section-nav";
import type { SolarSitePublic } from "@/lib/sems/sites";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ImportFilesButton } from "@/components/dashboard/import-files-button";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { RecordViewDialog } from "@/components/dashboard/record-view-dialog";
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

type SpecsForm = {
  panel_capacity_kw: string;
  inverter_model: string;
  battery_capacity_kwh: string;
  install_date: string;
  vendor: string;
  warranty_expiry: string;
  inverter_expiry: string;
  battery_expiry: string;
};

type LogForm = {
  log_date: string;
  generation_kwh: string;
  to_load_kwh: string;
  to_grid_kwh: string;
  consumption_kwh: string;
  from_pv_bat_kwh: string;
  from_grid_kwh: string;
  battery_soc_pct: string;
  alert_flag: boolean;
  notes: string;
};

const emptySpecs = (): SpecsForm => ({
  panel_capacity_kw: "",
  inverter_model: "",
  battery_capacity_kwh: "",
  install_date: "",
  vendor: "",
  warranty_expiry: "",
  inverter_expiry: "",
  battery_expiry: "",
});

const emptyLog = (): LogForm => ({
  log_date: "",
  generation_kwh: "",
  to_load_kwh: "",
  to_grid_kwh: "",
  consumption_kwh: "",
  from_pv_bat_kwh: "",
  from_grid_kwh: "",
  battery_soc_pct: "",
  alert_flag: false,
  notes: "",
});

function numOrEmpty(v: number | null | undefined) {
  return v == null ? "" : String(v);
}

function parseOptionalNumber(v: string) {
  return v === "" ? null : Number(v);
}

function fileNameFromPath(path: string | null) {
  if (!path) return null;
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

export function SolarPanel({
  sites,
  initialSpecs,
  initialLogs,
}: {
  sites: SolarSitePublic[];
  initialSiteId?: string;
  initialSpecs: SolarSpecs[];
  initialLogs: SolarMonitoringLog[];
}) {
  const router = useRouter();
  const [specs, setSpecs] = useState(initialSpecs);
  const [logs, setLogs] = useState(initialLogs);

  const [specsOpen, setSpecsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [editingSpecs, setEditingSpecs] = useState<SolarSpecs | null>(null);
  const [editingLog, setEditingLog] = useState<SolarMonitoringLog | null>(null);
  const [viewingSpecs, setViewingSpecs] = useState<SolarSpecs | null>(null);
  const [viewingLog, setViewingLog] = useState<SolarMonitoringLog | null>(null);
  const [specsForm, setSpecsForm] = useState<SpecsForm>(emptySpecs);
  const [logForm, setLogForm] = useState<LogForm>(emptyLog);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const specsSorted = useMemo(() => sortNewestFirst(specs), [specs]);
  const logsSorted = useMemo(() => sortNewestFirst(logs), [logs]);
  const specsPage = usePagedRows(specsSorted);
  const logsPage = usePagedRows(logsSorted);

  async function saveSpecs() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        panel_capacity_kw:
          specsForm.panel_capacity_kw === ""
            ? null
            : Number(specsForm.panel_capacity_kw),
        inverter_model: specsForm.inverter_model,
        battery_capacity_kwh:
          specsForm.battery_capacity_kwh === ""
            ? null
            : Number(specsForm.battery_capacity_kwh),
        install_date: specsForm.install_date || null,
        vendor: specsForm.vendor,
        warranty_expiry: specsForm.warranty_expiry || null,
        inverter_expiry: specsForm.inverter_expiry || null,
        battery_expiry: specsForm.battery_expiry || null,
      };

      let saved: SolarSpecs;
      if (editingSpecs) {
        saved = await apiFetch<SolarSpecs>(
          `/api/solar/specs/${editingSpecs.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
      } else {
        saved = await apiFetch<SolarSpecs>("/api/solar/specs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      if (uploadFile) {
        const formData = new FormData();
        formData.append("file", uploadFile);
        const res = await fetch(`/api/solar/specs/${saved.id}/upload`, {
          method: "POST",
          body: formData,
        });
        const json = (await res.json()) as {
          data?: SolarSpecs;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        saved = json.data!;
      }

      setSpecs((prev) => {
        const exists = prev.some((s) => s.id === saved.id);
        return exists
          ? prev.map((s) => (s.id === saved.id ? saved : s))
          : [saved, ...prev];
      });
      setSpecsOpen(false);
      setUploadFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveLog() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        log_date: logForm.log_date,
        generation_kwh: parseOptionalNumber(logForm.generation_kwh),
        to_load_kwh: parseOptionalNumber(logForm.to_load_kwh),
        to_grid_kwh: parseOptionalNumber(logForm.to_grid_kwh),
        consumption_kwh: parseOptionalNumber(logForm.consumption_kwh),
        from_pv_bat_kwh: parseOptionalNumber(logForm.from_pv_bat_kwh),
        from_grid_kwh: parseOptionalNumber(logForm.from_grid_kwh),
        battery_soc_pct: parseOptionalNumber(logForm.battery_soc_pct),
        alert_flag: logForm.alert_flag,
        notes: logForm.notes,
      };

      if (editingLog) {
        const data = await apiFetch<SolarMonitoringLog>(
          `/api/solar/monitoring/${editingLog.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setLogs((prev) => prev.map((i) => (i.id === data.id ? data : i)));
      } else {
        const data = await apiFetch<SolarMonitoringLog>(
          "/api/solar/monitoring",
          { method: "POST", body: JSON.stringify(payload) },
        );
        setLogs((prev) => upsertById(prev, data));
      }
      setLogOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function openFile(id: string) {
    const data = await apiFetch<{ url: string }>(
      `/api/solar/specs/${id}/file`,
    );
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Solar"
        description="System specs, document uploads, and monitoring logs."
        icon="solar"
        accent="teal"
      />

      <SolarSectionNav active="records" sites={sites} />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-lg font-semibold">System specs</h2>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <ExportButtons resource="solar-specs" />
            <ImportFilesButton target="solar-specs" />
            <Button
              onClick={() => {
                setEditingSpecs(null);
                setSpecsForm(emptySpecs());
                setUploadFile(null);
                setError(null);
                setSpecsOpen(true);
              }}
            >
              Add specs
            </Button>
          </div>
        </div>
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[16%]">Panels kW</TableHead>
                <TableHead className="w-[20%]">Inverter</TableHead>
                <TableHead className="w-[14%]">Battery</TableHead>
                <TableHead className="w-[14%]">Installed</TableHead>
                <TableHead className="w-[16%]">Spec file</TableHead>
                <TableHead className="w-[20%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {specsSorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No solar specs yet.
                  </TableCell>
                </TableRow>
              ) : (
                specsPage.pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <CellText>{row.panel_capacity_kw ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.inverter_model ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {row.battery_capacity_kwh == null
                          ? "—"
                          : `${row.battery_capacity_kwh} kWh`}
                      </CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.install_date ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      {row.spec_file_url ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto max-w-full truncate px-0"
                          onClick={() => openFile(row.id)}
                        >
                          {fileNameFromPath(row.spec_file_url)}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-none">
                      <TableActions>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingSpecs(row)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingSpecs(row);
                            setSpecsForm({
                              panel_capacity_kw:
                                row.panel_capacity_kw == null
                                  ? ""
                                  : String(row.panel_capacity_kw),
                              inverter_model: row.inverter_model ?? "",
                              battery_capacity_kwh:
                                row.battery_capacity_kwh == null
                                  ? ""
                                  : String(row.battery_capacity_kwh),
                              install_date: row.install_date ?? "",
                              vendor: row.vendor ?? "",
                              warranty_expiry: row.warranty_expiry ?? "",
                              inverter_expiry: row.inverter_expiry ?? "",
                              battery_expiry: row.battery_expiry ?? "",
                            });
                            setUploadFile(null);
                            setError(null);
                            setSpecsOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={async () => {
                            await apiFetch(`/api/solar/specs/${row.id}`, {
                              method: "DELETE",
                            });
                            setSpecs((prev) =>
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
          total={specsPage.total}
          page={specsPage.page}
          onPageChange={specsPage.setPage}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-lg font-semibold">Monitoring log</h2>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <ExportButtons resource="solar-monitoring" />
            <ImportFilesButton target="solar-monitoring" />
            <Button
              onClick={() => {
                setEditingLog(null);
                setLogForm(emptyLog());
                setError(null);
                setLogOpen(true);
              }}
            >
              Add log
            </Button>
          </div>
        </div>
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[12%]">Date</TableHead>
                <TableHead className="w-[10%]">Gen</TableHead>
                <TableHead className="w-[10%]">To Load</TableHead>
                <TableHead className="w-[10%]">To Grid</TableHead>
                <TableHead className="w-[10%]">Use</TableHead>
                <TableHead className="w-[10%]">Battery %</TableHead>
                <TableHead className="w-[10%]">Alert</TableHead>
                <TableHead className="w-[28%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsSorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No monitoring logs yet.
                  </TableCell>
                </TableRow>
              ) : (
                logsPage.pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <CellText>{row.log_date}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.generation_kwh ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.to_load_kwh ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.to_grid_kwh ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.consumption_kwh ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.battery_soc_pct ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.alert_flag ? "destructive" : "secondary"}
                      >
                        {row.alert_flag ? "alert" : "ok"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-none">
                      <TableActions>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingLog(row)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingLog(row);
                            setLogForm({
                              log_date: row.log_date,
                              generation_kwh: numOrEmpty(row.generation_kwh),
                              to_load_kwh: numOrEmpty(row.to_load_kwh),
                              to_grid_kwh: numOrEmpty(row.to_grid_kwh),
                              consumption_kwh: numOrEmpty(row.consumption_kwh),
                              from_pv_bat_kwh: numOrEmpty(row.from_pv_bat_kwh),
                              from_grid_kwh: numOrEmpty(row.from_grid_kwh),
                              battery_soc_pct: numOrEmpty(row.battery_soc_pct),
                              alert_flag: row.alert_flag,
                              notes: row.notes ?? "",
                            });
                            setError(null);
                            setLogOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={async () => {
                            await apiFetch(`/api/solar/monitoring/${row.id}`, {
                              method: "DELETE",
                            });
                            setLogs((prev) =>
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
          total={logsPage.total}
          page={logsPage.page}
          onPageChange={logsPage.setPage}
        />
      </section>

      <RecordViewDialog
        open={viewingSpecs != null}
        onOpenChange={(open) => {
          if (!open) setViewingSpecs(null);
        }}
        title="View solar specs"
        fields={
          viewingSpecs
            ? [
                {
                  label: "Panel capacity",
                  value:
                    viewingSpecs.panel_capacity_kw == null
                      ? null
                      : `${viewingSpecs.panel_capacity_kw} kW`,
                },
                {
                  label: "Battery capacity",
                  value:
                    viewingSpecs.battery_capacity_kwh == null
                      ? null
                      : `${viewingSpecs.battery_capacity_kwh} kWh`,
                },
                {
                  label: "Inverter model",
                  value: viewingSpecs.inverter_model,
                },
                { label: "Vendor", value: viewingSpecs.vendor },
                { label: "Install date", value: viewingSpecs.install_date },
                {
                  label: "Warranty expiry",
                  value: viewingSpecs.warranty_expiry,
                },
                {
                  label: "Inverter expiry",
                  value: viewingSpecs.inverter_expiry,
                },
                {
                  label: "Battery expiry",
                  value: viewingSpecs.battery_expiry,
                },
                {
                  label: "Spec file",
                  value: viewingSpecs.spec_file_url
                    ? fileNameFromPath(viewingSpecs.spec_file_url)
                    : null,
                },
                {
                  label: "Created",
                  value: viewingSpecs.created_at?.slice(0, 19).replace("T", " "),
                },
                {
                  label: "Updated",
                  value: viewingSpecs.updated_at?.slice(0, 19).replace("T", " "),
                },
              ]
            : []
        }
      />

      <RecordViewDialog
        open={viewingLog != null}
        onOpenChange={(open) => {
          if (!open) setViewingLog(null);
        }}
        title="View monitoring log"
        fields={
          viewingLog
            ? [
                { label: "Log date", value: viewingLog.log_date },
                {
                  label: "Generation",
                  value:
                    viewingLog.generation_kwh == null
                      ? null
                      : `${viewingLog.generation_kwh} kWh`,
                },
                {
                  label: "To Load",
                  value:
                    viewingLog.to_load_kwh == null
                      ? null
                      : `${viewingLog.to_load_kwh} kWh`,
                },
                {
                  label: "To Grid",
                  value:
                    viewingLog.to_grid_kwh == null
                      ? null
                      : `${viewingLog.to_grid_kwh} kWh`,
                },
                {
                  label: "Consumption",
                  value:
                    viewingLog.consumption_kwh == null
                      ? null
                      : `${viewingLog.consumption_kwh} kWh`,
                },
                {
                  label: "From PV&BAT",
                  value:
                    viewingLog.from_pv_bat_kwh == null
                      ? null
                      : `${viewingLog.from_pv_bat_kwh} kWh`,
                },
                {
                  label: "From Grid",
                  value:
                    viewingLog.from_grid_kwh == null
                      ? null
                      : `${viewingLog.from_grid_kwh} kWh`,
                },
                {
                  label: "Battery SOC",
                  value:
                    viewingLog.battery_soc_pct == null
                      ? null
                      : `${viewingLog.battery_soc_pct}%`,
                },
                {
                  label: "Alert",
                  value: viewingLog.alert_flag ? "alert" : "ok",
                },
                { label: "Notes", value: viewingLog.notes },
                {
                  label: "Created",
                  value: viewingLog.created_at?.slice(0, 19).replace("T", " "),
                },
                {
                  label: "Updated",
                  value: viewingLog.updated_at?.slice(0, 19).replace("T", " "),
                },
              ]
            : []
        }
      />

      <Dialog open={specsOpen} onOpenChange={setSpecsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSpecs ? "Edit solar specs" : "Add solar specs"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Panel capacity (kW)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={specsForm.panel_capacity_kw}
                onChange={(e) =>
                  setSpecsForm((p) => ({
                    ...p,
                    panel_capacity_kw: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Battery capacity (kWh)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={specsForm.battery_capacity_kwh}
                onChange={(e) =>
                  setSpecsForm((p) => ({
                    ...p,
                    battery_capacity_kwh: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Inverter model</Label>
              <Input
                value={specsForm.inverter_model}
                onChange={(e) =>
                  setSpecsForm((p) => ({
                    ...p,
                    inverter_model: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Install date</Label>
              <Input
                type="date"
                value={specsForm.install_date}
                onChange={(e) =>
                  setSpecsForm((p) => ({
                    ...p,
                    install_date: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Warranty expiry</Label>
              <Input
                type="date"
                value={specsForm.warranty_expiry}
                onChange={(e) =>
                  setSpecsForm((p) => ({
                    ...p,
                    warranty_expiry: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Inverter expiry</Label>
              <Input
                type="date"
                value={specsForm.inverter_expiry}
                onChange={(e) =>
                  setSpecsForm((p) => ({
                    ...p,
                    inverter_expiry: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Battery expiry</Label>
              <Input
                type="date"
                value={specsForm.battery_expiry}
                onChange={(e) =>
                  setSpecsForm((p) => ({
                    ...p,
                    battery_expiry: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Vendor</Label>
              <Input
                value={specsForm.vendor}
                onChange={(e) =>
                  setSpecsForm((p) => ({ ...p, vendor: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Spec file (PDF / Word)</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
              {editingSpecs?.spec_file_url ? (
                <p className="text-xs text-muted-foreground">
                  Current: {fileNameFromPath(editingSpecs.spec_file_url)}
                </p>
              ) : null}
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpecsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSpecs} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLog ? "Edit monitoring log" : "Add monitoring log"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Log date</Label>
              <Input
                type="date"
                value={logForm.log_date}
                onChange={(e) =>
                  setLogForm((p) => ({ ...p, log_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Battery SOC %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="any"
                value={logForm.battery_soc_pct}
                onChange={(e) =>
                  setLogForm((p) => ({
                    ...p,
                    battery_soc_pct: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Generation kWh</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={logForm.generation_kwh}
                onChange={(e) =>
                  setLogForm((p) => ({
                    ...p,
                    generation_kwh: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Consumption kWh</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={logForm.consumption_kwh}
                onChange={(e) =>
                  setLogForm((p) => ({
                    ...p,
                    consumption_kwh: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>To Load kWh</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={logForm.to_load_kwh}
                onChange={(e) =>
                  setLogForm((p) => ({
                    ...p,
                    to_load_kwh: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>To Grid kWh</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={logForm.to_grid_kwh}
                onChange={(e) =>
                  setLogForm((p) => ({
                    ...p,
                    to_grid_kwh: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>From PV&BAT kWh</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={logForm.from_pv_bat_kwh}
                onChange={(e) =>
                  setLogForm((p) => ({
                    ...p,
                    from_pv_bat_kwh: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>From Grid kWh</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={logForm.from_grid_kwh}
                onChange={(e) =>
                  setLogForm((p) => ({
                    ...p,
                    from_grid_kwh: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="alert_flag"
                type="checkbox"
                checked={logForm.alert_flag}
                onChange={(e) =>
                  setLogForm((p) => ({ ...p, alert_flag: e.target.checked }))
                }
              />
              <Label htmlFor="alert_flag">Alert flag</Label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={logForm.notes}
                onChange={(e) =>
                  setLogForm((p) => ({ ...p, notes: e.target.value }))
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
            <Button variant="outline" onClick={() => setLogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveLog}
              disabled={saving || !logForm.log_date}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
