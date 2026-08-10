"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WriteToolName } from "@/lib/validations/agent-writes";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  imagePreviews?: string[];
};

export type PendingConfirmation = {
  tool: WriteToolName;
  summary: string;
  args: Record<string, unknown>;
};

type ChatSessionContextValue = {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  pending: PendingConfirmation | null;
  setPending: React.Dispatch<React.SetStateAction<PendingConfirmation | null>>;
  toolsUsed: string[];
  setToolsUsed: React.Dispatch<React.SetStateAction<string[]>>;
  modelUsed: string | null;
  setModelUsed: React.Dispatch<React.SetStateAction<string | null>>;
  keyLabel: string | null;
  setKeyLabel: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
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
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [keyLabel, setKeyLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clearChatSession = useCallback(() => {
    setMessages([]);
    setPending(null);
    setToolsUsed([]);
    setModelUsed(null);
    setKeyLabel(null);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      messages,
      setMessages,
      pending,
      setPending,
      toolsUsed,
      setToolsUsed,
      modelUsed,
      setModelUsed,
      keyLabel,
      setKeyLabel,
      loading,
      setLoading,
      clearChatSession,
    }),
    [
      messages,
      pending,
      toolsUsed,
      modelUsed,
      keyLabel,
      loading,
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
