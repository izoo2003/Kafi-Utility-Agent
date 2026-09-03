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
  CellPrimary,
  CellText,
  TableActions,
  TableShell,
} from "@/components/dashboard/table-shell";
import { usePagedRows } from "@/lib/dashboard/use-paged-rows";
import { apiFetch } from "@/lib/dashboard/api-client";
import { formatDate } from "@/lib/format/datetime";
import { formatMoney } from "@/lib/tenants/payment-status";
import {
  agreementExpiryLabel,
  agreementExpiryStatus,
} from "@/lib/tenants/agreement";
import { tenantListStatus } from "@/lib/tenants/ledger";
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Survey no.</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Monthly total</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="max-w-none py-8 text-center text-muted-foreground"
                >
                  No tenants yet. Add a tenant to generate their monthly ledger.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((tenant) => {
                const expiry = agreementExpiryStatus(
                  tenant.contract_end_date ?? tenant.agreement_expiry,
                );
                return (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/tenants/${tenant.id}`)}
                  >
                    <TableCell>
                      <CellPrimary title={tenant.tenant_name} />
                    </TableCell>
                    <TableCell>
                      <CellText>{tenant.survey_no ?? "—"}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>
                        {tenant.contract_start_date && tenant.contract_end_date
                          ? `${formatDate(tenant.contract_start_date)} – ${formatDate(tenant.contract_end_date)}`
                          : "—"}
                      </CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{formatMoney(tenant.monthly_total)}</CellText>
                    </TableCell>
                    <TableCell>
                      <CellText>{formatMoney(tenant.outstanding)}</CellText>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {tenantListStatus(tenant, tenant.outstanding)}
                        {expiry === "soon" || expiry === "expired"
                          ? ` · ${agreementExpiryLabel(expiry)}`
                          : ""}
                      </span>
                    </TableCell>
                    <TableCell
                      className="max-w-none"
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
