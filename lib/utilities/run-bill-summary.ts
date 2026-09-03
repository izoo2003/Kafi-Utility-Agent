import type { SupabaseClient, User } from "@supabase/supabase-js";
import { withUpdatedBy } from "@/lib/api/with-user";
import { normalizeKeyPart } from "@/lib/dashboard/dedupe";
import {
  getUtilityAccount,
  listUtilityAccounts,
  listUtilityPaymentLogs,
  updateUtilityPaymentLog,
} from "@/lib/supabase/utilities";
import { downloadUtilityBillBytes } from "@/lib/supabase/utility-storage";
import type { UtilityAccount, UtilityPaymentLog } from "@/lib/types/database";
import {
  buildBillComparison,
  type BillComparison,
} from "@/lib/utilities/bill-comparison";
import { generateUtilityBillSummary } from "@/lib/utilities/bill-summary-ai";
import {
  isActiveSiteUtilityProvider,
  providerByLabel,
} from "@/lib/utilities/providers";

export function unitsLabelForUtility(
  utilityType: string | null | undefined,
  menuKey: string | null,
) {
  if (utilityType === "electricity") return "Units (kWh)";
  if (utilityType === "gas") return "Units (CM)";
  if (menuKey === "water-tanker") return "Tankers";
  return "Units";
}

export type UtilityBillSummaryPayload = {
  comparison: BillComparison;
  summary: string | null;
  model: string | null;
  generated_at: string | null;
  payment_id: string;
  cached: boolean;
  payment?: UtilityPaymentLog;
};

export type BillSummaryFailure = {
  ok: false;
  status: number;
  error: string;
  matches?: Array<{ id: string; provider: string | null }>;
};

export async function resolveUtilityAccountForBillSummary(
  supabase: SupabaseClient,
  input: { utility_account_id?: string; provider?: string },
): Promise<
  { ok: true; account: UtilityAccount } | BillSummaryFailure
> {
  const id = input.utility_account_id?.trim();
  if (id) {
    const { data, error } = await getUtilityAccount(supabase, id);
    if (error) return { ok: false, status: 500, error: error.message };
    if (!data) {
      return { ok: false, status: 404, error: "Utility account not found" };
    }
    return { ok: true, account: data as UtilityAccount };
  }

  const provider = input.provider?.trim();
  if (!provider) {
    return {
      ok: false,
      status: 400,
      error: "Pass utility_account_id or provider (exact dashboard label).",
    };
  }

  const { data, error } = await listUtilityAccounts(supabase);
  if (error) return { ok: false, status: 500, error: error.message };
  const rows = (data ?? []).filter((r) =>
    isActiveSiteUtilityProvider(r.provider),
  );
  const known = providerByLabel(provider);
  const needle = normalizeKeyPart(known?.label ?? provider);

  const matches = rows.filter((r) => {
    const label = normalizeKeyPart(r.provider);
    if (label === needle) return true;
    if (known && label === normalizeKeyPart(known.label)) return true;
    return label.includes(needle) || needle.includes(label);
  });

  if (matches.length === 1) {
    return { ok: true, account: matches[0]! };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      status: 400,
      error: "Multiple utility accounts matched that provider. Use utility_account_id.",
      matches: matches.map((r) => ({ id: r.id, provider: r.provider })),
    };
  }
  return {
    ok: false,
    status: 404,
    error: `No utility account found for "${provider}". Call utility_accounts_list first.`,
  };
}

export async function runUtilityBillSummary(opts: {
  supabase: SupabaseClient;
  user: User;
  account: UtilityAccount;
  regenerate: boolean;
  /** When false, return comparison + cached AI text only (never call Gemini). */
  allowGenerate?: boolean;
}): Promise<{ ok: true; data: UtilityBillSummaryPayload } | BillSummaryFailure> {
  const {
    supabase,
    user,
    account,
    regenerate,
    allowGenerate = true,
  } = opts;
  const { data: payments, error: payError } = await listUtilityPaymentLogs(
    supabase,
    account.id,
  );
  if (payError) return { ok: false, status: 500, error: payError.message };

  const rows = payments ?? [];
  if (!rows.length) {
    return {
      ok: false,
      status: 400,
      error: "Log at least one payment before generating a bill summary.",
    };
  }

  const comparison = buildBillComparison(rows);
  const current = rows.find((r) => r.id === comparison.current?.id) ?? rows[0]!;
  const known = providerByLabel(account.provider);
  const label = account.provider ?? account.utility_type;

  if (current.ai_summary && !regenerate) {
    return {
      ok: true,
      data: {
        comparison,
        summary: current.ai_summary,
        model: current.ai_summary_model,
        generated_at: current.ai_summary_at,
        payment_id: current.id,
        cached: true,
        payment: current,
      },
    };
  }

  if (!allowGenerate) {
    return {
      ok: true,
      data: {
        comparison,
        summary: current.ai_summary,
        model: current.ai_summary_model,
        generated_at: current.ai_summary_at,
        payment_id: current.id,
        cached: Boolean(current.ai_summary),
        payment: current,
      },
    };
  }

  let billFile: {
    mimeType: string;
    base64: string;
    fileName: string;
  } | null = null;
  if (current.bill_file_url) {
    const downloaded = await downloadUtilityBillBytes(
      supabase,
      current.bill_file_url,
    );
    if (!("error" in downloaded) && downloaded.bytes.length <= 10 * 1024 * 1024) {
      billFile = {
        mimeType: downloaded.mimeType,
        base64: downloaded.bytes.toString("base64"),
        fileName: downloaded.fileName,
      };
    }
  }

  try {
    const ai = await generateUtilityBillSummary({
      providerLabel: label,
      siteLabel: known?.siteLabel ?? label,
      utilityType: account.utility_type,
      unitsLabel: unitsLabelForUtility(
        account.utility_type,
        known?.menuKey ?? null,
      ),
      comparison,
      billFile,
    });

    const generatedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await updateUtilityPaymentLog(
      supabase,
      current.id,
      withUpdatedBy(
        {
          ai_summary: ai.summary,
          ai_summary_model: ai.model,
          ai_summary_at: generatedAt,
        },
        user,
      ),
    );
    if (updateError) {
      return { ok: false, status: 500, error: updateError.message };
    }

    return {
      ok: true,
      data: {
        comparison,
        summary: ai.summary,
        model: ai.model,
        generated_at: generatedAt,
        payment_id: current.id,
        cached: false,
        payment: updated ?? undefined,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate bill summary";
    return { ok: false, status: 502, error: message };
  }
}
