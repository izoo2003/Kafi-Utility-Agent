"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatSession } from "@/components/chat/chat-session-context";
import { filesToChatAttachments, MAX_CHAT_ATTACHMENTS } from "@/lib/chat/attachments";
import {
  importPromptFor,
  type ImportTarget,
} from "@/lib/dashboard/import-targets";

export function ImportFilesButton({
  target,
  label = "Import PDF/Image",
}: {
  target: ImportTarget;
  label?: string;
}) {
  const router = useRouter();
  const { queueSectionImport } = useChatSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy(true);
    setError(null);
    try {
      const files = Array.from(fileList).slice(0, MAX_CHAT_ATTACHMENTS);
      if (fileList.length > MAX_CHAT_ATTACHMENTS) {
        setError(`Using first ${MAX_CHAT_ATTACHMENTS} files only.`);
      }
      const attachments = await filesToChatAttachments(files);
      queueSectionImport({
        prompt: importPromptFor(target),
        attachments,
        target,
      });
      router.push("/dashboard/chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import files");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title="Import PDF or images into this section via the agent"
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileUp className="size-3.5" />
        )}
        {busy ? "Preparing…" : label}
      </Button>
      {error ? (
        <p className="max-w-[16rem] text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
