import { z } from "zod";
import { writeToolNameSchema } from "@/lib/validations/agent-writes";

export const chatImageSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  data: z
    .string()
    .min(1)
    .max(7_000_000)
    .refine((v) => !v.startsWith("data:"), {
      message: "Image data must be raw base64 without a data: URL prefix",
    }),
});

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
    images: z.array(chatImageSchema).max(6).optional(),
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
    const hasImages = (v.images?.length ?? 0) > 0;
    if (!hasText && !hasImages) {
      ctx.addIssue({
        code: "custom",
        message: "Provide a message and/or at least one image.",
        path: ["messages"],
      });
    }
  });

export type ChatImageInput = z.infer<typeof chatImageSchema>;
