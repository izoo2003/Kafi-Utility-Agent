import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isExportResource,
  loadExportBundle,
} from "@/lib/export/resources";
import { PrintReportActions } from "@/components/dashboard/print-report";
import { BrokerPrintSlips } from "@/components/dashboard/broker-print-slips";
import type { TenantBrokerListRow } from "@/lib/supabase/tenant-brokers";

type Props = {
  params: Promise<{ resource: string }>;
  searchParams: Promise<{ print?: string; id?: string }>;
};

export default async function ExportPrintPage({ params, searchParams }: Props) {
  const { resource } = await params;
  const { print, id } = await searchParams;
  if (!isExportResource(resource)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bundle = await loadExportBundle(supabase, resource);
  const rows = id
    ? bundle.rows.filter((row) => String(row.id) === id)
    : bundle.rows;
  const generated = new Date().toLocaleString();
  const title =
    bundle.layout === "broker-slips" && rows.length === 1
      ? `Commission — ${String(rows[0].broker_name ?? "broker")}`
      : bundle.title;

  return (
    <div className="export-print-page mx-auto max-w-5xl bg-white px-4 py-6 text-foreground print:max-w-none print:px-0 print:py-0">
      <PrintReportActions
        title={title}
        autoPrint={print === "1" || print === "true"}
      />

      <div className="mb-4 hidden print:block">
        <h1 className="font-heading text-xl font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">Generated {generated}</p>
      </div>

      <p className="mb-3 text-xs text-muted-foreground print:mb-2">
        {rows.length} {bundle.layout === "broker-slips" ? "slip" : "row"}
        {rows.length === 1 ? "" : "s"} · {generated}
      </p>

      {bundle.layout === "broker-slips" ? (
        <BrokerPrintSlips rows={rows as unknown as TenantBrokerListRow[]} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[oklch(0.88_0.02_220)] print:overflow-visible print:rounded-none print:border-black/20">
          <table className="w-full table-auto border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b bg-[oklch(0.97_0.01_220)] print:bg-transparent">
                {bundle.columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-2 py-2 align-bottom font-semibold break-words"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    className="px-2 py-4 text-muted-foreground"
                    colSpan={bundle.columns.length}
                  >
                    No rows to export.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-[oklch(0.92_0.015_220)] print:border-black/10"
                  >
                    {bundle.columns.map((col) => {
                      const value = col.value(row);
                      return (
                        <td
                          key={col.key}
                          className="px-2 py-1.5 align-top break-words"
                        >
                          {value == null || value === "" ? "—" : String(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
