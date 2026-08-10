"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  Loader2,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { WriteToolName } from "@/lib/validations/agent-writes";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  imagePreviews?: string[];
};

type PendingConfirmation = {
  tool: WriteToolName;
  summary: string;
  args: Record<string, unknown>;
};

type PendingImage = {
  id: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string;
  previewUrl: string;
  name: string;
};

const SUGGESTIONS = [
  "What's low in kitchen inventory?",
  "Analyze these solar photos and fill specs or logs",
  "Log 20 liters of fuel for the generator today",
  "Give me a site status summary",
];

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function normalizeMime(
  type: string,
): PendingImage["mimeType"] | null {
  if (type === "image/jpg") return "image/jpeg";
  if (
    type === "image/jpeg" ||
    type === "image/png" ||
    type === "image/webp" ||
    type === "image/gif"
  ) {
    return type;
  }
  return null;
}

async function fileToPendingImage(file: File): Promise<PendingImage> {
  const mimeType = normalizeMime(file.type);
  if (!mimeType) {
    throw new Error(`${file.name}: use JPG, PNG, WebP, or GIF`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name}: max 4 MB per image`);
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
    previewUrl: dataUrl,
    name: file.name,
  };
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [keyLabel, setKeyLabel] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, pending, images]);

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError(null);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`You can attach up to ${MAX_IMAGES} images.`);
      return;
    }

    const selected = Array.from(fileList).slice(0, remaining);
    try {
      const next = await Promise.all(selected.map(fileToPendingImage));
      setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add image");
    }
  }

  async function send(content: string) {
    const trimmed = content.trim();
    if (loading) return;
    if (!trimmed && images.length === 0) return;

    const displayContent =
      trimmed ||
      `Analyze ${images.length} attached image${images.length === 1 ? "" : "s"} and update the right records.`;

    const attached = images;
    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content: displayContent,
        imagePreviews: attached.map((i) => i.previewUrl),
      },
    ];
    setMessages(nextMessages);
    setInput("");
    setImages([]);
    setError(null);
    setLoading(true);
    setToolsUsed([]);
    setModelUsed(null);
    setKeyLabel(null);
    setPending(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: c }) => ({
            role,
            content: c,
          })),
          images: attached.map(({ mimeType, data }) => ({ mimeType, data })),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        data?: {
          message: ChatMessage;
          toolsUsed?: string[];
          model?: string;
          keyLabel?: string;
          pendingConfirmation?: PendingConfirmation | null;
        };
      };

      if (!res.ok) {
        throw new Error(json.error ?? `Request failed (${res.status})`);
      }

      setMessages((prev) => [...prev, json.data!.message]);
      setToolsUsed(json.data?.toolsUsed ?? []);
      setModelUsed(json.data?.model ?? null);
      setKeyLabel(json.data?.keyLabel ?? null);
      setPending(json.data?.pendingConfirmation ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirmPending() {
    if (!pending || loading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: `Confirm: ${pending.summary}` },
    ];
    setMessages(nextMessages);
    setError(null);
    setLoading(true);
    setToolsUsed([]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({
            role,
            content,
          })),
          confirmWrite: {
            tool: pending.tool,
            args: pending.args,
          },
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        data?: {
          message: ChatMessage;
          toolsUsed?: string[];
        };
      };

      if (!res.ok) {
        throw new Error(json.error ?? `Request failed (${res.status})`);
      }

      setMessages((prev) => [...prev, json.data!.message]);
      setToolsUsed(json.data?.toolsUsed ?? []);
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setLoading(false);
    }
  }

  function cancelPending() {
    if (!pending || loading) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Cancel that change." },
      {
        role: "assistant",
        content: "Cancelled — nothing was changed.",
      },
    ]);
    setPending(null);
  }

  return (
    <div className="flex h-[min(70dvh,760px)] min-h-[22rem] flex-col overflow-hidden rounded-xl border border-[oklch(0.88_0.02_220)] bg-white/75 shadow-[0_1px_0_oklch(0.9_0.02_220)] backdrop-blur-sm sm:h-[min(72vh,760px)] sm:rounded-2xl">
      <div className="flex items-center gap-2 border-b border-[oklch(0.9_0.02_220)] px-3 py-3 sm:px-4">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[oklch(0.93_0.04_195)] text-[oklch(0.38_0.08_195)]">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold">Ops assistant</p>
          <p className="truncate text-xs text-muted-foreground">
            Text, images, confirmed writes · dual API key failover
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
        {messages.length === 0 ? (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ask about site ops, attach solar/generator photos to extract
              specs or logs, or request adds/edits/deletes. Changes preview
              first — then Confirm.
            </p>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-xl border border-[oklch(0.88_0.02_220)] bg-[oklch(0.98_0.01_220)] px-3 py-2.5 text-left text-sm transition-colors hover:border-[oklch(0.75_0.05_195)] hover:bg-white"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn(
                "max-w-[92%] space-y-2 rounded-2xl px-3 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap sm:max-w-[85%] sm:px-3.5 sm:text-[0.95rem]",
                message.role === "user"
                  ? "ml-auto bg-[oklch(0.42_0.09_195)] text-[oklch(0.99_0.01_195)]"
                  : "mr-auto border border-[oklch(0.9_0.02_220)] bg-[oklch(0.985_0.01_220)] text-foreground",
              )}
            >
              {message.imagePreviews?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {message.imagePreviews.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src.slice(0, 48)}
                      src={src}
                      alt="Attached"
                      className="h-16 w-16 rounded-lg object-cover ring-1 ring-black/10"
                    />
                  ))}
                </div>
              ) : null}
              <div>{message.content}</div>
            </div>
          ))
        )}

        {pending && !loading ? (
          <div className="mr-auto max-w-[92%] space-y-3 rounded-2xl border border-[oklch(0.82_0.06_85)] bg-[oklch(0.98_0.03_95)] px-3.5 py-3 sm:max-w-[85%]">
            <p className="text-sm font-medium text-foreground">
              Confirm this change?
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {pending.summary}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void confirmPending()}
                className="gap-1.5"
              >
                <Check className="size-3.5" />
                Confirm
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={cancelPending}
                className="gap-1.5"
              >
                <X className="size-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-[oklch(0.9_0.02_220)] bg-[oklch(0.985_0.01_220)] px-3.5 py-2.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {pending
              ? "Applying change…"
              : images.length || messages.some((m) => m.imagePreviews?.length)
                ? "Analyzing…"
                : "Checking site records…"}
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {(error || toolsUsed.length > 0 || modelUsed || keyLabel) && (
        <div className="space-y-1 border-t border-[oklch(0.92_0.015_220)] px-4 py-2 text-xs">
          {error ? (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {modelUsed ? (
            <p className="text-muted-foreground">
              Model: {modelUsed}
              {keyLabel ? ` · Key: ${keyLabel}` : ""}
            </p>
          ) : null}
          {toolsUsed.length > 0 ? (
            <p className="text-muted-foreground">
              Tools used: {toolsUsed.join(", ")}
            </p>
          ) : null}
        </div>
      )}

      {images.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-[oklch(0.92_0.015_220)] px-3 py-2">
          {images.map((img) => (
            <div key={img.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt={img.name}
                className="h-14 w-14 rounded-lg object-cover ring-1 ring-black/10"
              />
              <button
                type="button"
                aria-label={`Remove ${img.name}`}
                className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                onClick={() =>
                  setImages((prev) => prev.filter((p) => p.id !== img.id))
                }
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-end gap-2 border-t border-[oklch(0.9_0.02_220)] p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={loading || images.length >= MAX_IMAGES}
          className="h-11 shrink-0 px-3"
          onClick={() => fileRef.current?.click()}
          title="Attach images"
        >
          <ImagePlus className="size-4" />
          <span className="sr-only">Attach images</span>
        </Button>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask, or attach photos to extract records…"
          rows={2}
          className="min-h-[48px] flex-1 resize-none text-base sm:min-h-[56px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files).filter((f) =>
              f.type.startsWith("image/"),
            );
            if (files.length) {
              e.preventDefault();
              const dt = new DataTransfer();
              files.forEach((f) => dt.items.add(f));
              void addFiles(dt.files);
            }
          }}
        />
        <Button
          type="submit"
          disabled={loading || (!input.trim() && images.length === 0)}
          className="h-11 shrink-0 px-3"
        >
          <SendHorizontal className="size-4" />
          <span className="sr-only sm:not-sr-only sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
}
