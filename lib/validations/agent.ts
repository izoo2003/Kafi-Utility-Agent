import { z } from "zod";
import { writeToolNameSchema } from "@/lib/validations/agent-writes";

export const chatAttachmentSchema = z.object({
  mimeType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ]),
  data: z
    .string()
    .min(1)
    .max(16_000_000)
    .refine((v) => !v.startsWith("data:"), {
      message: "Attachment data must be raw base64 without a data: URL prefix",
    }),
  name: z.string().trim().max(240).optional(),
});

/** @deprecated use chatAttachmentSchema — kept for older clients */
export const chatImageSchema = chatAttachmentSchema;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
});

export const confirmWriteSchema = z.object({
  tool: writeToolNameSchema,
  args: z.record(z.string(), z.unknown()),
});

export const agentChatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(40),
    /** Images and/or PDFs (scanned log sheets, receipts, etc.) */
    attachments: z.array(chatAttachmentSchema).max(8).optional(),
    /** Legacy alias for attachments */
    images: z.array(chatAttachmentSchema).max(8).optional(),
    confirmWrite: confirmWriteSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.confirmWrite) return;

    const last = v.messages[v.messages.length - 1];
    if (!last || last.role !== "user") {
      ctx.addIssue({
        code: "custom",
        message: "Last message must be from the user.",
        path: ["messages"],
      });
      return;
    }

    const hasText = last.content.trim().length > 0;
    const attachCount =
      (v.attachments?.length ?? 0) + (v.images?.length ?? 0);
    if (!hasText && attachCount === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Provide a message and/or at least one image or PDF.",
        path: ["messages"],
      });
    }
  });

export type ChatAttachmentInput = z.infer<typeof chatAttachmentSchema>;
export type ChatImageInput = ChatAttachmentInput;
