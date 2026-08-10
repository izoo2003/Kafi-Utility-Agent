"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  GeneratorFuelLog,
  GeneratorMaintenance,
} from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
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

type MaintForm = {
  service_date: string;
  next_service_due: string;
  service_type: string;
  vendor: string;
  cost: string;
  notes: string;
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
  service_type: "",
  vendor: "",
  cost: "",
  notes: "",
});

const emptyFuel = (): FuelForm => ({
  log_date: "",
  liters_added: "",
  running_hours: "",
  fuel_level_pct: "",
  cost: "",
  notes: "",
});

export function GeneratorPanel({
  initialMaintenance,
  initialFuel,
}: {
  initialMaintenance: GeneratorMaintenance[];
  initialFuel: GeneratorFuelLog[];
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

  const maintSorted = useMemo(
    () =>
      [...maintenance].sort((a, b) =>
        b.service_date.localeCompare(a.service_date),
      ),
    [maintenance],
  );
  const fuelSorted = useMemo(
    () => [...fuel].sort((a, b) => b.log_date.localeCompare(a.log_date)),
    [fuel],
  );

  async function saveMaint() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        service_date: maintForm.service_date,
        next_service_due: maintForm.next_service_due || null,
        service_type: maintForm.service_type,
        vendor: maintForm.vendor,
        cost: maintForm.cost === "" ? null : Number(maintForm.cost),
        notes: maintForm.notes,
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
        description="Maintenance schedule and fuel log."
        icon="generator"
        accent="orange"
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">Maintenance</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons resource="generator-maintenance" />
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
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[14%]">Service date</TableHead>
                <TableHead className="w-[14%]">Next due</TableHead>
                <TableHead className="w-[18%]">Type</TableHead>
                <TableHead className="w-[18%]">Vendor</TableHead>
                <TableHead className="w-[12%]">Cost</TableHead>
                <TableHead className="w-[24%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintSorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="max-w-none py-8 text-center text-muted-foreground"
                  >
                    No maintenance records yet.
                  </TableCell>
                </TableRow>
              ) : (
                maintSorted.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <CellText>{row.service_date}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{row.next_service_due ?? "—"}</CellText>
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

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">Fuel log</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons resource="generator-fuel" />
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
                      <CellText>{row.log_date}</CellText>
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
                onChange={(e) =>
                  setMaintForm((p) => ({ ...p, service_date: e.target.value }))
                }
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
