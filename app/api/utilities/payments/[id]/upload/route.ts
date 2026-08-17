import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { withUpdatedBy } from "@/lib/api/with-user";
import { updateUtilityPaymentLog } from "@/lib/supabase/utilities";
import {
  isAllowedUtilityBillFile,
  removeUtilityBillFile,
  uploadUtilityBillFile,
} from "@/lib/supabase/utility-storage";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!isAllowedUtilityBillFile(file)) {
    return NextResponse.json(
      { error: "Only PDF or image bills are allowed" },
      { status: 400 },
    );
  }

  const existing = await supabase
    .from("utility_payment_logs")
    .select("id, bill_file_url")
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "Payment log not found" }, { status: 404 });
  }

  const { path, error: uploadError } = await uploadUtilityBillFile(
    supabase,
    id,
    file,
  );
  if (uploadError || !path) {
    return NextResponse.json(
      { error: uploadError?.message ?? "Upload failed" },
      { status: 500 },
    );
  }

  if (existing.data.bill_file_url) {
    await removeUtilityBillFile(supabase, existing.data.bill_file_url);
  }

  const { data, error } = await updateUtilityPaymentLog(
    supabase,
    id,
    withUpdatedBy({ bill_file_url: path }, user),
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
