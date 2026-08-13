"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { WriteToolName } from "@/lib/validations/agent-writes";
import type { ChatPendingAttachment } from "@/lib/chat/attachments";
import type { ImportTarget } from "@/lib/dashboard/import-targets";

export type ChatAttachmentPreview = {
  kind: "image" | "pdf";
  /** data URL for images; unused for PDFs */
  url?: string;
  name: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** @deprecated use attachmentPreviews */
  imagePreviews?: string[];
  attachmentPreviews?: ChatAttachmentPreview[];
};

export type PendingConfirmation = {
  tool: WriteToolName;
  summary: string;
  args: Record<string, unknown>;
};

export type SectionImportJob = {
  prompt: string;
  attachments: ChatPendingAttachment[];
  target: ImportTarget;
};

type ChatSessionContextValue = {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** Current confirmation (head of queue) */
  pending: PendingConfirmation | null;
  setPending: React.Dispatch<React.SetStateAction<PendingConfirmation | null>>;
  /** Remaining confirmations after the current one */
  pendingQueue: PendingConfirmation[];
  setPendingQueue: React.Dispatch<React.SetStateAction<PendingConfirmation[]>>;
  toolsUsed: string[];
  setToolsUsed: React.Dispatch<React.SetStateAction<string[]>>;
  modelUsed: string | null;
  setModelUsed: React.Dispatch<React.SetStateAction<string | null>>;
  keyLabel: string | null;
  setKeyLabel: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  /** Dashboard section import → chat auto-send */
  pendingImport: SectionImportJob | null;
  queueSectionImport: (job: SectionImportJob) => void;
  takePendingImport: () => SectionImportJob | null;
  clearChatSession: () => void;
};

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

/**
 * Holds chat history for the whole dashboard session.
 * Survives navigating between sections; clears on logout / full page reload / tab close.
 */
export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PendingConfirmation[]>([]);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [keyLabel, setKeyLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingImport, setPendingImport] = useState<SectionImportJob | null>(
    null,
  );
  const pendingImportRef = useRef<SectionImportJob | null>(null);

  const queueSectionImport = useCallback((job: SectionImportJob) => {
    pendingImportRef.current = job;
    setPendingImport(job);
  }, []);

  const takePendingImport = useCallback(() => {
    const job = pendingImportRef.current;
    pendingImportRef.current = null;
    setPendingImport(null);
    return job;
  }, []);

  const clearChatSession = useCallback(() => {
    setMessages([]);
    setPending(null);
    setPendingQueue([]);
    setToolsUsed([]);
    setModelUsed(null);
    setKeyLabel(null);
    setLoading(false);
    pendingImportRef.current = null;
    setPendingImport(null);
  }, []);

  const value = useMemo(
    () => ({
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
      queueSectionImport,
      takePendingImport,
      clearChatSession,
    }),
    [
      messages,
      pending,
      pendingQueue,
      toolsUsed,
      modelUsed,
      keyLabel,
      loading,
      pendingImport,
      queueSectionImport,
      takePendingImport,
      clearChatSession,
    ],
  );

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSession() {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) {
    throw new Error("useChatSession must be used within ChatSessionProvider");
  }
  return ctx;
}
