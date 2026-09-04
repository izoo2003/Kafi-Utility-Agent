import { apiFetch } from "@/lib/dashboard/api-client";

async function uploadForm<T>(url: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(url, { method: "POST", body: formData });
  const json = (await res.json()) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Upload failed");
  if (!json.data) throw new Error("Upload failed");
  return json.data;
}

export async function uploadTenantAgreement<T>(id: string, file: File) {
  return uploadForm<T>(`/api/tenants/${id}/agreement`, file);
}

export async function uploadTenantPayment<T>(id: string, file: File) {
  return uploadForm<T>(`/api/tenants/${id}/payment`, file);
}

export async function uploadRentPaymentReceipt<T>(id: string, file: File) {
  return uploadForm<T>(`/api/tenants/payments/${id}/receipt`, file);
}

export async function uploadElectricBillFile<T>(id: string, file: File) {
  return uploadForm<T>(`/api/tenants/electric-bills/${id}/bill`, file);
}

export async function openTenantDocument(url: string) {
  const data = await apiFetch<{ url: string }>(url);
  window.open(data.url, "_blank", "noopener,noreferrer");
}
