import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseErrorResponse } from "@/lib/api/parse";
import { findSolarSite } from "@/lib/sems/config";
import { buildSolarEnergySummary } from "@/lib/solar/energy-summary";
import { computeNetMeteringRow, formatRs } from "@/lib/solar/net-metering-calc";
import {
  extractKeBillFromPdf,
  generateNetMeteringNarrative,
} from "@/lib/solar/net-metering-ai";
import {
  createSolarNetMeteringLog,
  getLatestNetBalanceForSite,
  listSolarNetMeteringLogs,
  netMeteringBillPath,
} from "@/lib/supabase/solar-net-metering";
import { UTILITY_BILLS_BUCKET } from "@/lib/types/database";
import { isAllowedUtilityBillFile } from "@/lib/supabase/utility-storage";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const params = new URL(request.url).searchParams;
  const site = params.get("site")?.trim();
  const account = params.get("account")?.trim();
  const { data, error } = await listSolarNetMeteringLogs(supabase, {
    siteId: site,
    accountNumber: account,
  });
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ ok: true, data: { logs: data ?? [] } });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "KE bill PDF is required" }, { status: 400 });
  }
  if (!isAllowedUtilityBillFile(file)) {
    return NextResponse.json(
      { error: "Upload a PDF or image of the K-Electric bill" },
      { status: 400 },
    );
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "File must be under 10 MB" }, { status: 400 });
  }

  const site = findSolarSite(String(form.get("site") ?? "").trim());
  if (!site) {
    return NextResponse.json(
      { error: "Select a solar plant. Each plant has its own net metering ledger." },
      { status: 400 },
    );
  }
  const previousBalanceInput = parseOptionalNumber(form.get("previous_balance_rs"));
  const refundInput = parseOptionalNumber(form.get("refund_rs")) ?? 0;
  const save = form.get("save") !== "0";

  const buffer = Buffer.from(await file.arrayBuffer());
  const pdfBase64 = buffer.toString("base64");
  const mimeType = file.type || "application/pdf";

  try {
    const { extraction, model: extractModel } = await extractKeBillFromPdf(
      pdfBase64,
      file.name,
    );

    if (extraction.net_metering_rs == null && extraction.consumed_rs == null) {
      return NextResponse.json(
        {
          error:
            "Could not find net metering credit or consumption amounts on this bill. Try a clearer PDF or enter values manually.",
          extraction,
        },
        { status: 422 },
      );
    }

    let previousBalance = previousBalanceInput;
    if (previousBalance == null) {
      const latest = await getLatestNetBalanceForSite(supabase, site.id);
      if (latest.data?.net_balance_rs != null) {
        previousBalance = Number(latest.data.net_balance_rs);
      }
    }
    if (previousBalance == null && extraction.previous_balance_rs != null) {
      previousBalance = extraction.previous_balance_rs;
    }
    if (previousBalance == null) previousBalance = 0;

    const netMetering = extraction.net_metering_rs ?? 0;
    const consumed = extraction.consumed_rs ?? extraction.current_charges_rs ?? 0;

    const calc = computeNetMeteringRow({
      previous_balance_rs: previousBalance,
      net_metering_rs: netMetering,
      consumed_rs: consumed,
      refund_rs: refundInput,
    });

    let semsExportKwh: number | null = null;
    if (extraction.bill_month) {
      try {
        const summary = await buildSolarEnergySummary(
          supabase,
          site,
          extraction.bill_month,
        );
        semsExportKwh = summary.exported_kwh;
      } catch {
        semsExportKwh = null;
      }
    }

    const { narrative, model: narrativeModel } =
      await generateNetMeteringNarrative(
        extraction,
        { ...calc, previous_balance_rs: previousBalance },
        semsExportKwh,
        site.label,
      );

    let log = null;
    let billFilePath: string | null = null;

    if (save) {
      const insertResult = await createSolarNetMeteringLog(supabase, {
        solar_site_id: site.id,
        ke_account_number: extraction.ke_account_number,
        consumer_name: extraction.consumer_name,
        bill_period_label: extraction.bill_period_label,
        bill_month: extraction.bill_month,
        previous_balance_rs: previousBalance,
        net_metering_rs: netMetering,
        consumed_rs: consumed,
        gross_balance_rs: calc.gross_balance_rs,
        refund_rs: calc.refund_rs,
        net_balance_rs: calc.net_balance_rs,
        estimated_refund_rs: calc.estimated_refund_rs,
        units_import_kwh: extraction.units_import_kwh,
        units_export_kwh: extraction.units_export_kwh,
        payable_rs: extraction.payable_rs,
        ai_extraction: extraction,
        ai_narrative: narrative,
        sems_export_kwh: semsExportKwh,
        notes: extraction.extraction_notes,
        updated_by: user.id,
      });

      if (insertResult.error) {
        return supabaseErrorResponse(insertResult.error.message);
      }

      log = insertResult.data;
      if (log) {
        billFilePath = netMeteringBillPath(log.id, file.name);
        const { error: uploadError } = await supabase.storage
          .from(UTILITY_BILLS_BUCKET)
          .upload(billFilePath, buffer, {
            contentType: mimeType,
            upsert: false,
          });
        if (!uploadError) {
          await supabase
            .from("solar_net_metering_logs")
            .update({ bill_file_path: billFilePath })
            .eq("id", log.id);
          log = { ...log, bill_file_path: billFilePath };
        }
      }
    }

    const ledger = await listSolarNetMeteringLogs(supabase, {
      siteId: site.id,
    });

    return NextResponse.json({
      ok: true,
      data: {
        extraction,
        calculation: calc,
        formatted: {
          previous_balance_rs: formatRs(previousBalance),
          net_metering_rs: formatRs(netMetering),
          consumed_rs: formatRs(consumed),
          gross_balance_rs: formatRs(calc.gross_balance_rs),
          estimated_refund_rs: formatRs(calc.estimated_refund_rs),
          net_balance_rs: formatRs(calc.net_balance_rs),
        },
        narrative,
        sems_export_kwh: semsExportKwh,
        log,
        ledger: ledger.data ?? [],
        models: { extract: extractModel, narrative: narrativeModel },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Net metering analysis failed",
      },
      { status: 500 },
    );
  }
}
