import { apiFetch } from "@/lib/dashboard/api-client";

export type WarrantyResource = "it-equipment" | "appliances";

export async function uploadWarrantyCardFile<T>(
  resource: WarrantyResource,
  id: string,
  file: File,
): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/${resource}/${id}/warranty`, {
    method: "POST",
    body: formData,
  });
  const json = (await res.json()) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Upload failed");
  if (!json.data) throw new Error("Upload failed");
  return json.data;
}

export async function openWarrantyCard(
  resource: WarrantyResource,
  id: string,
) {
  const data = await apiFetch<{ url: string }>(
    `/api/${resource}/${id}/warranty`,
  );
  window.open(data.url, "_blank", "noopener,noreferrer");
}
