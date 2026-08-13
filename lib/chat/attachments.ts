export type ChatPendingAttachment = {
  id: string;
  mimeType:
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "image/gif"
    | "application/pdf";
  data: string;
  previewUrl: string | null;
  name: string;
  kind: "image" | "pdf";
};

export const MAX_CHAT_ATTACHMENTS = 8;
export const MAX_CHAT_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_CHAT_PDF_BYTES = 10 * 1024 * 1024;

function normalizeMime(
  type: string,
  fileName: string,
): ChatPendingAttachment["mimeType"] | null {
  if (type === "image/jpg") return "image/jpeg";
  if (
    type === "image/jpeg" ||
    type === "image/png" ||
    type === "image/webp" ||
    type === "image/gif" ||
    type === "application/pdf"
  ) {
    return type;
  }
  if (!type && fileName.toLowerCase().endsWith(".pdf")) {
    return "application/pdf";
  }
  return null;
}

export async function fileToChatAttachment(
  file: File,
): Promise<ChatPendingAttachment> {
  const mimeType = normalizeMime(file.type, file.name);
  if (!mimeType) {
    throw new Error(`${file.name}: use JPG, PNG, WebP, GIF, or PDF`);
  }

  const isPdf = mimeType === "application/pdf";
  const maxBytes = isPdf ? MAX_CHAT_PDF_BYTES : MAX_CHAT_IMAGE_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      `${file.name}: max ${isPdf ? "10 MB per PDF" : "4 MB per image"}`,
    );
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const comma = dataUrl.indexOf(",");
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;

  return {
    id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
    mimeType,
    data,
    previewUrl: isPdf ? null : dataUrl,
    name: file.name,
    kind: isPdf ? "pdf" : "image",
  };
}

export async function filesToChatAttachments(
  files: File[],
  max = MAX_CHAT_ATTACHMENTS,
): Promise<ChatPendingAttachment[]> {
  const selected = files.slice(0, max);
  return Promise.all(selected.map(fileToChatAttachment));
}
