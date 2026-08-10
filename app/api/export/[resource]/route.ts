import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { csvFilename, toCsv } from "@/lib/export/csv";
import {
  isExportResource,
  loadExportBundle,
} from "@/lib/export/resources";

type Params = { params: Promise<{ resource: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { resource } = await params;
  if (!isExportResource(resource)) {
    return NextResponse.json({ error: "Unknown export resource" }, { status: 404 });
  }

  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  try {
    const bundle = await loadExportBundle(supabase, resource);
    const csv = toCsv(bundle.rows, bundle.columns);
    const filename = csvFilename(bundle.filename);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
