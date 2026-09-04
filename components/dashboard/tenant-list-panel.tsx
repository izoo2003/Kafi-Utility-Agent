"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TenantListSummary } from "@/lib/supabase/tenants";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { ImportFilesButton } from "@/components/dashboard/import-files-button";
import { TablePagination } from "@/components/dashboard/table-pagination";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import {
  CellText,
  TableActions,
  TableShell,
} from "@/components/dashboard/table-shell";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { apiFetch } from "@/lib/dashboard/api-client";
import { formatDate } from "@/lib/format/datetime";
import { formatMoney } from "@/lib/tenants/payment-status";
import {
  type AgreementExpiryStatus,
  agreementExpiryStatus,
} from "@/lib/tenants/agreement";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function expiryPillClass(status: AgreementExpiryStatus) {
  switch (status) {
    case "expired":
      return "bg-[oklch(0.95_0.04_25)] text-[oklch(0.45_0.14_25)]";
    case "soon":
      return "bg-[oklch(0.95_0.04_85)] text-[oklch(0.45_0.12_70)]";
    case "ok":
      return "bg-[oklch(0.95_0.03_155)] text-[oklch(0.4_0.1_155)]";
    default:
      return "bg-[oklch(0.95_0.01_230)] text-[oklch(0.5_0.02_230)]";
  }
}

function expiryLabel(status: AgreementExpiryStatus) {
  switch (status) {
    case "expired":
      return "Expired";
    case "soon":
      return "Expiring";
    case "ok":
      return "Active";
    default:
      return "No date";
  }
}

function statusPillClass(hasDates: boolean, outstanding: number) {
  if (!hasDates) {
    return "bg-[oklch(0.95_0.01_230)] text-[oklch(0.5_0.02_230)]";
  }
  if (outstanding > 0) {
    return "bg-[oklch(0.95_0.04_85)] text-[oklch(0.45_0.12_70)]";
  }
  return "bg-[oklch(0.95_0.03_155)] text-[oklch(0.4_0.1_155)]";
}

function statusLabel(hasDates: boolean, outstanding: number) {
  if (!hasDates) return "No dates";
  if (outstanding > 0) return "Due";
  return "Current";
}

export function TenantListPanel({
  initialItems,
}: {
  initialItems: TenantListSummary[];
}) {
  const router = useRouter();
  const sorted = useMemo(
    () =>
      [...initialItems].sort((a, b) =>
        a.tenant_name.localeCompare(b.tenant_name),
      ),
    [initialItems],
  );
  const { page, setPage, pageRows, total } = usePagedRows(sorted);

  async function remove(id: string) {
    await apiFetch(`/api/tenants/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Tenants"
          description="Open a tenant for the contract ledger, monthly receipts, and electricity bills."
          icon="tenants"
          accent="violet"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
          <ExportButtons resource="tenants" />
          <ImportFilesButton target="tenants" />
          <Link
            href="/dashboard/tenants/new"
            className={cn(buttonVariants())}
          >
            Add tenant
          </Link>
        </div>
      </div>

      <TableShell>
        <Table style={{ minWidth: "68rem" }}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-52">Tenant</TableHead>
              <TableHead className="w-20">Sqft</TableHead>
              <TableHead className="w-28">Rate</TableHead>
              <TableHead className="w-44">Contract</TableHead>
              <TableHead className="w-28">Expiry</TableHead>
              <TableHead className="w-28">Monthly total</TableHead>
              <TableHead className="w-32">Electricity due</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="max-w-none py-8 text-center text-muted-foreground"
                >
                  No tenants yet. Add a tenant to generate their monthly ledger.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((tenant) => {
                const expiryDate =
                  tenant.contract_end_date ?? tenant.agreement_expiry;
                const expiryStatus = agreementExpiryStatus(expiryDate);
                const electricityDue = tenant.electricity_due_month;
                return (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/tenants/${tenant.id}`)}
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <div className="break-words font-medium leading-snug text-foreground">
                          {tenant.tenant_name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              "inline-flex shrink-0 rounded-md px-1.5 py-0.5 font-medium",
                              tenant.classification === "official"
                                ? "bg-[oklch(0.95_0.04_150)] text-[oklch(0.4_0.12_150)]"
                                : "bg-[oklch(0.94_0.01_230)] text-[oklch(0.45_0.02_230)]",
                            )}
                          >
                            {tenant.classification === "official"
                              ? "Official"
                              : "Unofficial"}
                          </span>
                          {tenant.survey_no ? (
                            <span className="truncate">{tenant.survey_no}</span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <CellText className="whitespace-nowrap tabular-nums">
                        {tenant.sqft == null
                          ? "—"
                          : Number(tenant.sqft).toLocaleString()}
                      </CellText>
                    </TableCell>
                    <TableCell className="align-top">
                      {tenant.rate_type === "lum_sum" ? (
                        <span className="text-muted-foreground">Lum sum</span>
                      ) : tenant.rate == null ? (
                        <CellText>—</CellText>
                      ) : (
                        <CellText className="whitespace-nowrap tabular-nums">
                          {formatMoney(tenant.rate)}{" "}
                          <span className="text-muted-foreground">/sqft</span>
                        </CellText>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="break-words leading-snug">
                        {tenant.contract_start_date && tenant.contract_end_date
                          ? `${formatDate(tenant.contract_start_date)} – ${formatDate(tenant.contract_end_date)}`
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
                          expiryPillClass(expiryStatus),
                        )}
                        title={
                          expiryDate
                            ? `Agreement ends ${formatDate(expiryDate)}`
                            : "No agreement expiry set"
                        }
                      >
                        {expiryLabel(expiryStatus)}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <CellText className="whitespace-nowrap tabular-nums">
                        {formatMoney(tenant.monthly_total)}
                      </CellText>
                    </TableCell>
                    <TableCell className="align-top">
                      {electricityDue == null ? (
                        <CellText className="text-muted-foreground">
                          —
                        </CellText>
                      ) : (
                        <CellText
                          className={cn(
                            "whitespace-nowrap tabular-nums",
                            electricityDue > 0 &&
                              "font-medium text-[oklch(0.5_0.14_25)]",
                          )}
                        >
                          {formatMoney(electricityDue)}
                        </CellText>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
                          statusPillClass(Boolean(expiryDate), tenant.outstanding),
                        )}
                        title={
                          !expiryDate
                            ? "No contract dates set"
                            : tenant.outstanding > 0
                              ? "Rent balance due across the ledger"
                              : "Rent is up to date"
                        }
                      >
                        {statusLabel(Boolean(expiryDate), tenant.outstanding)}
                      </span>
                    </TableCell>
                    <TableCell
                      className="max-w-none align-top"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TableActions>
                        <Link
                          href={`/dashboard/tenants/${tenant.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Open
                        </Link>
                        <ConfirmDeleteButton
                          title={`Delete ${tenant.tenant_name}?`}
                          description="This deletes the contract ledger, payments, and electricity bills."
                          onConfirm={() => remove(tenant.id)}
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
      {total > 0 ? (
        <TablePagination total={total} page={page} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
