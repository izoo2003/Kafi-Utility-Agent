import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabaseErrorResponse } from "@/lib/api/parse";
import { isAllowedTenantDocumentFile } from "@/lib/supabase/tenant-storage";
import {
  clearRentPaymentFile,
  clearTenantAgreementFile,
  clearTenantPaymentFile,
  setRentPaymentFile,
  setTenantAgreementFile,
  setTenantPaymentFile,
} from "@/lib/supabase/tenant-documents";
import { createTenantDocumentSignedUrl } from "@/lib/supabase/tenant-storage";
import { getTenant, getTenantRentPayment } from "@/lib/supabase/tenants";

async function readUploadFile(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: NextResponse.json({ error: "File is required" }, { status: 400 }) };
  }
  if (!isAllowedTenantDocumentFile(file)) {
    return {
      error: NextResponse.json(
        { error: "Only PDF or image files (JPG/PNG/WebP) are allowed" },
        { status: 400 },
      ),
    };
  }
  return { file };
}

export async function postTenantAgreement(
  request: Request,
  id: string,
  user: User,
  supabase: SupabaseClient,
) {
  const parsed = await readUploadFile(request);
  if ("error" in parsed && parsed.error) return parsed.error;
  const { data, error } = await setTenantAgreementFile(
    supabase,
    user,
    id,
    parsed.file!,
  );
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function deleteTenantAgreement(
  id: string,
  user: User,
  supabase: SupabaseClient,
) {
  const { data, error } = await clearTenantAgreementFile(supabase, user, id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function getTenantAgreementUrl(
  id: string,
  supabase: SupabaseClient,
) {
  const { data, error } = await getTenant(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  if (!data?.agreement_file_url) {
    return NextResponse.json({ error: "No agreement file attached" }, { status: 404 });
  }
  const signed = await createTenantDocumentSignedUrl(
    supabase,
    data.agreement_file_url,
  );
  if (signed.error || !signed.data?.signedUrl) {
    return supabaseErrorResponse(signed.error?.message ?? "Could not sign URL");
  }
  return NextResponse.json({ data: { url: signed.data.signedUrl } });
}

export async function postTenantPayment(
  request: Request,
  id: string,
  user: User,
  supabase: SupabaseClient,
) {
  const parsed = await readUploadFile(request);
  if ("error" in parsed && parsed.error) return parsed.error;
  const { data, error } = await setTenantPaymentFile(
    supabase,
    user,
    id,
    parsed.file!,
  );
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function deleteTenantPaymentFile(
  id: string,
  user: User,
  supabase: SupabaseClient,
) {
  const { data, error } = await clearTenantPaymentFile(supabase, user, id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function getTenantPaymentUrl(
  id: string,
  supabase: SupabaseClient,
) {
  const { data, error } = await getTenant(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  if (!data?.payment_file_url) {
    return NextResponse.json({ error: "No payment file attached" }, { status: 404 });
  }
  const signed = await createTenantDocumentSignedUrl(
    supabase,
    data.payment_file_url,
  );
  if (signed.error || !signed.data?.signedUrl) {
    return supabaseErrorResponse(signed.error?.message ?? "Could not sign URL");
  }
  return NextResponse.json({ data: { url: signed.data.signedUrl } });
}

export async function postRentPaymentReceipt(
  request: Request,
  id: string,
  user: User,
  supabase: SupabaseClient,
) {
  const parsed = await readUploadFile(request);
  if ("error" in parsed && parsed.error) return parsed.error;
  const { data, error } = await setRentPaymentFile(
    supabase,
    user,
    id,
    parsed.file!,
  );
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function deleteRentPaymentReceipt(
  id: string,
  user: User,
  supabase: SupabaseClient,
) {
  const { data, error } = await clearRentPaymentFile(supabase, user, id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function getRentPaymentReceiptUrl(
  id: string,
  supabase: SupabaseClient,
) {
  const { data, error } = await getTenantRentPayment(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  if (!data?.payment_file_url) {
    return NextResponse.json({ error: "No payment file attached" }, { status: 404 });
  }
  const signed = await createTenantDocumentSignedUrl(
    supabase,
    data.payment_file_url,
  );
  if (signed.error || !signed.data?.signedUrl) {
    return supabaseErrorResponse(signed.error?.message ?? "Could not sign URL");
  }
  return NextResponse.json({ data: { url: signed.data.signedUrl } });
}
