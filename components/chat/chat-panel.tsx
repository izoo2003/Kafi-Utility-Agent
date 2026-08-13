"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  FileText,
  ImagePlus,
  Loader2,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useChatSession,
  type ChatAttachmentPreview,
  type ChatMessage,
  type PendingConfirmation,
} from "@/components/chat/chat-session-context";
import {
  fileToChatAttachment,
  MAX_CHAT_ATTACHMENTS,
  type ChatPendingAttachment,
} from "@/lib/chat/attachments";

const SUGGESTIONS = [
  "What's low in kitchen inventory?",
  "Add these as generator expenses (use debit)",
  "Import maintenance — accounts & description only",
  "Give me a site status summary",
];

function applyConfirmations(
  list: PendingConfirmation[],
  setPending: (v: PendingConfirmation | null) => void,
  setPendingQueue: (v: PendingConfirmation[]) => void,
) {
  if (!list.length) {
    setPending(null);
    setPendingQueue([]);
    return;
  }
  setPending(list[0]!);
  setPendingQueue(list.slice(1));
}

function formatToolsUsed(tools: string[]): string {
  const counts = new Map<string, number>();
  for (const t of tools) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, n]) => (n > 1 ? `${name} × ${n}` : name))
    .join(", ");
}

export function ChatPanel() {
  const {
    messages,
    setMessages,
    pending,
    setPending,
    pendingQueue,
    setPendingQueue,
    toolsUsed,
    setToolsUsed,
    modelUsed,
    setModelUsed,
    keyLabel,
    setKeyLabel,
    loading,
    setLoading,
    pendingImport,
    takePendingImport,
  } = useChatSession();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatPendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [batchConfirming, setBatchConfirming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importStartedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, pending, attachments]);

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError(null);
    const remaining = MAX_CHAT_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      setError(`You can attach up to ${MAX_CHAT_ATTACHMENTS} files.`);
      return;
    }

    const selected = Array.from(fileList).slice(0, remaining);
    try {
      const next = await Promise.all(selected.map(fileToChatAttachment));
      setAttachments((prev) =>
        [...prev, ...next].slice(0, MAX_CHAT_ATTACHMENTS),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add file");
    }
  }

  async function send(
    content: string,
    filesOverride?: ChatPendingAttachment[],
  ) {
    const attached = filesOverride ?? attachments;
    const trimmed = content.trim();
    if (loading) return;
    if (!trimmed && attached.length === 0) return;

    const pdfCount = attached.filter((a) => a.kind === "pdf").length;
    const imageCount = attached.length - pdfCount;
    const displayContent =
      trimmed ||
      (attached.length
        ? `Analyze ${attached.length} attached file${attached.length === 1 ? "" : "s"} (${[
            pdfCount ? `${pdfCount} PDF${pdfCount === 1 ? "" : "s"}` : "",
            imageCount
              ? `${imageCount} image${imageCount === 1 ? "" : "s"}`
              : "",
          ]
            .filter(Boolean)
            .join(", ")}) and add each log/expense row to the correct section.`
        : "");
    const attachmentPreviews: ChatAttachmentPreview[] = attached.map((a) =>
      a.kind === "pdf"
        ? { kind: "pdf", name: a.name }
        : { kind: "image", name: a.name, url: a.previewUrl ?? undefined },
    );

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content: displayContent,
        attachmentPreviews,
        imagePreviews: attached
          .filter((a) => a.previewUrl)
          .map((a) => a.previewUrl!),
      },
    ];
    setMessages(nextMessages);
    setInput("");
    setAttachments([]);
    setError(null);
    setLoading(true);
    setToolsUsed([]);
    setModelUsed(null);
    setKeyLabel(null);
    setPending(null);
    setPendingQueue([]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: c }) => ({
            role,
            content: c,
          })),
          attachments: attached.map(({ mimeType, data, name }) => ({
            mimeType,
            data,
            name,
          })),
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
          pendingConfirmations?: PendingConfirmation[];
        };
      };

      if (!res.ok) {
        throw new Error(json.error ?? `Request failed (${res.status})`);
      }

      setMessages((prev) => [...prev, json.data!.message]);
      setToolsUsed(json.data?.toolsUsed ?? []);
      setModelUsed(json.data?.model ?? null);
      setKeyLabel(json.data?.keyLabel ?? null);

      const queue =
        json.data?.pendingConfirmations?.length
          ? json.data.pendingConfirmations
          : json.data?.pendingConfirmation
            ? [json.data.pendingConfirmation]
            : [];
      applyConfirmations(queue, setPending, setPendingQueue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!pendingImport || loading || importStartedRef.current) return;
    const job = takePendingImport();
    if (!job) return;
    importStartedRef.current = true;
    void send(job.prompt, job.attachments).finally(() => {
      importStartedRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when a section import is queued
  }, [pendingImport, loading, takePendingImport]);

  async function confirmPending() {
    if (!pending || loading) return;

    const current = pending;
    const remaining = pendingQueue;

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content: `Confirm: ${current.summary}`,
      },
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
            tool: current.tool,
            args: current.args,
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

      const left = remaining.length;
      const baseReply = json.data!.message.content;
      const progressNote =
        left > 0
          ? `\n\n${left} more record${left === 1 ? "" : "s"} waiting for confirm.`
          : "";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `${baseReply}${progressNote}` },
      ]);
      setToolsUsed(json.data?.toolsUsed ?? []);
      applyConfirmations(remaining, setPending, setPendingQueue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirmAllPending() {
    if (!pending || loading) return;
    const batch = [pending, ...pendingQueue];
    if (batch.length < 2) {
      await confirmPending();
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content: `Confirm all ${batch.length} pending records.`,
      },
    ];
    setMessages(nextMessages);
    setError(null);
    setLoading(true);
    setBatchConfirming(true);
    setToolsUsed([]);
    setPending(null);
    setPendingQueue([]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({
            role,
            content,
          })),
          confirmWrites: batch.map(({ tool, args }) => ({ tool, args })),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        data?: {
          message: ChatMessage;
          toolsUsed?: string[];
          confirmedCount?: number;
        };
      };

      if (!res.ok && !json.data?.message) {
        throw new Error(json.error ?? `Request failed (${res.status})`);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            json.data?.message.content ??
            json.error ??
            "Batch confirm finished.",
        },
      ]);
      setToolsUsed(json.data?.toolsUsed ?? []);
      if (!res.ok) {
        setError(json.error ?? "Some records failed to confirm");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm all failed");
    } finally {
      setBatchConfirming(false);
      setLoading(false);
    }
  }

  function leavePending() {
    if (!pending || loading) return;
    const skipped = 1 + pendingQueue.length;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Leave — discard pending confirms." },
      {
        role: "assistant",
        content:
          skipped > 1
            ? `Left as-is — nothing was saved (${skipped} pending records discarded).`
            : "Left as-is — nothing was saved.",
      },
    ]);
    setPending(null);
    setPendingQueue([]);
  }

  const queueTotal = pending ? 1 + pendingQueue.length : 0;
  const hasAnyPreviews = messages.some(
    (m) =>
      (m.attachmentPreviews?.length ?? 0) > 0 ||
      (m.imagePreviews?.length ?? 0) > 0,
  );

  return (
    <div className="flex h-[min(72dvh,820px)] min-h-[22rem] w-full flex-col overflow-hidden rounded-xl border border-[oklch(0.88_0.02_220)] bg-white/75 shadow-[0_1px_0_oklch(0.9_0.02_220)] backdrop-blur-sm sm:h-[min(75vh,820px)] sm:rounded-2xl">
      <div className="flex items-center gap-2 border-b border-[oklch(0.9_0.02_220)] px-3 py-3 sm:px-4">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[oklch(0.93_0.04_195)] text-[oklch(0.38_0.08_195)]">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold">Ops assistant</p>
          <p className="truncate text-xs text-muted-foreground">
            Images + PDFs · history kept while you browse
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
        {messages.length === 0 ? (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ask about site ops, or attach fuel/maintenance log PDFs or photos.
              Say which section they belong to — each row is previewed; Confirm
              one by one or use Confirm all.
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
              {message.attachmentPreviews?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {message.attachmentPreviews.map((att) =>
                    att.kind === "pdf" ? (
                      <div
                        key={`${att.name}-${att.kind}`}
                        className="inline-flex max-w-[10rem] items-center gap-1.5 rounded-lg bg-black/15 px-2 py-1.5 text-xs"
                      >
                        <FileText className="size-3.5 shrink-0" />
                        <span className="truncate">{att.name}</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={att.url?.slice(0, 48) ?? att.name}
                        src={att.url}
                        alt={att.name}
                        className="h-16 w-16 rounded-lg object-cover ring-1 ring-black/10"
                      />
                    ),
                  )}
                </div>
              ) : message.imagePreviews?.length ? (
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

        {loading ? (
          <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-[oklch(0.9_0.02_220)] bg-[oklch(0.985_0.01_220)] px-3.5 py-2.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {batchConfirming
              ? "Applying all records…"
              : pending
                ? "Applying change…"
                : attachments.length || hasAnyPreviews
                  ? "Reading logs / attachments…"
                  : "Checking site records…"}
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {pending && !loading ? (
        <div className="shrink-0 space-y-3 border-t border-[oklch(0.82_0.06_85)] bg-[oklch(0.98_0.03_95)] px-3 py-3 sm:px-4">
          <p className="text-sm font-medium text-foreground">
            {queueTotal > 1
              ? `Confirm record 1 of ${queueTotal}?`
              : "Confirm this change?"}
          </p>
          <p className="max-h-20 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
            {pending.summary}
          </p>
          {queueTotal > 1 ? (
            <p className="text-xs text-muted-foreground">
              {pendingQueue.length} more after this. Confirm saves one; Confirm
              all saves every pending record; Leave discards all without saving.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Confirm saves this record; Leave discards it without saving.
            </p>
          )}
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
            {queueTotal > 1 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void confirmAllPending()}
                className="gap-1.5"
              >
                <CheckCheck className="size-3.5" />
                Confirm all ({queueTotal})
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={leavePending}
              className="gap-1.5"
            >
              <X className="size-3.5" />
              Leave
            </Button>
          </div>
        </div>
      ) : null}

      {(error || toolsUsed.length > 0 || modelUsed || keyLabel) && (
        <div className="shrink-0 space-y-1 border-t border-[oklch(0.92_0.015_220)] px-4 py-2 text-xs">
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
              Tools used: {formatToolsUsed(toolsUsed)}
            </p>
          ) : null}
        </div>
      )}

      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-[oklch(0.92_0.015_220)] px-3 py-2">
          {attachments.map((file) => (
            <div key={file.id} className="relative">
              {file.kind === "pdf" ? (
                <div className="flex h-14 max-w-[9rem] items-center gap-1.5 rounded-lg bg-[oklch(0.96_0.02_220)] px-2 ring-1 ring-black/10">
                  <FileText className="size-4 shrink-0 text-[oklch(0.4_0.08_195)]" />
                  <span className="truncate text-xs">{file.name}</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.previewUrl!}
                  alt={file.name}
                  className="h-14 w-14 rounded-lg object-cover ring-1 ring-black/10"
                />
              )}
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                onClick={() =>
                  setAttachments((prev) => prev.filter((p) => p.id !== file.id))
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
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf"
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
          disabled={loading || attachments.length >= MAX_CHAT_ATTACHMENTS}
          className="h-11 shrink-0 px-3"
          onClick={() => fileRef.current?.click()}
          title="Attach images or PDFs"
        >
          <ImagePlus className="size-4" />
          <span className="sr-only">Attach images or PDFs</span>
        </Button>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Add these as generator fuel logs…"
          rows={2}
          className="min-h-[48px] flex-1 resize-none text-base sm:min-h-[56px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files).filter(
              (f) =>
                f.type.startsWith("image/") ||
                f.type === "application/pdf" ||
                f.name.toLowerCase().endsWith(".pdf"),
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
          disabled={loading || (!input.trim() && attachments.length === 0)}
          className="h-11 shrink-0 px-3"
        >
          <SendHorizontal className="size-4" />
          <span className="sr-only sm:not-sr-only sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
}
