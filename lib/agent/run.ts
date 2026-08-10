import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from "@google/generative-ai";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { agentSystemPrompt } from "@/lib/agent/system-prompt";
import { agentTools } from "@/lib/agent/tools";
import {
  executeAgentTool,
  extractPendingConfirmation,
  type PendingConfirmation,
} from "@/lib/agent/handlers";
import {
  getGeminiModelCandidates,
  getOrderedGeminiApiKeys,
  isGeminiKeyExhaustedError,
  isRetryableGeminiModelError,
  markGeminiKeyExhausted,
  markGeminiKeySuccess,
} from "@/lib/agent/models";
import type { ChatImageInput } from "@/lib/validations/agent";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_TOOL_ROUNDS = 6;

function toGeminiHistory(messages: ChatMessage[]): Content[] {
  const prior = messages.slice(0, -1);
  return prior.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content || "(empty)" }],
  }));
}

function buildLatestUserParts(
  text: string,
  images: ChatImageInput[] | undefined,
): string | Part[] {
  const trimmed = text.trim();
  const defaultText =
    trimmed ||
    (images?.length
      ? "Analyze the attached image(s). Extract any facility ops data and propose the correct create/update tools (especially solar specs vs monitoring logs). Use confirmed=false first."
      : "");

  if (!images?.length) {
    return defaultText;
  }

  const parts: Part[] = [{ text: defaultText }];
  for (const image of images) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    });
  }
  return parts;
}

async function runWithModel(
  genAI: GoogleGenerativeAI,
  modelName: string,
  ctx: { supabase: SupabaseClient; user: User },
  messages: ChatMessage[],
  latestParts: string | Part[],
): Promise<{
  reply: string;
  toolsUsed: string[];
  model: string;
  pendingConfirmation: PendingConfirmation | null;
}> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: agentSystemPrompt,
    tools: [{ functionDeclarations: agentTools }],
  });

  const chat = model.startChat({
    history: toGeminiHistory(messages),
  });

  const toolsUsed: string[] = [];
  let pendingConfirmation: PendingConfirmation | null = null;
  let result = await chat.sendMessage(latestParts);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const functionCalls = result.response.functionCalls();

    if (!functionCalls?.length) {
      const text = result.response.text()?.trim();
      return {
        reply: text || "I couldn’t produce a response. Try asking again.",
        toolsUsed,
        model: modelName,
        pendingConfirmation,
      };
    }

    const responseParts: Part[] = [];

    for (const call of functionCalls) {
      toolsUsed.push(call.name);
      try {
        const toolResult = await executeAgentTool(
          ctx,
          call.name,
          (call.args ?? {}) as Record<string, unknown>,
        );
        const pending = extractPendingConfirmation(toolResult);
        if (pending && !pendingConfirmation) {
          pendingConfirmation = pending;
        }
        responseParts.push({
          functionResponse: {
            name: call.name,
            response: {
              result: toolResult,
            },
          },
        });
      } catch (error) {
        responseParts.push({
          functionResponse: {
            name: call.name,
            response: {
              error:
                error instanceof Error
                  ? error.message
                  : "Tool execution failed",
            },
          },
        });
      }
    }

    result = await chat.sendMessage(responseParts);
  }

  return {
    reply:
      "I hit the tool-call limit while looking that up. Ask a narrower question, or try again.",
    toolsUsed,
    model: modelName,
    pendingConfirmation,
  };
}

export async function runFacilityOpsAgent(
  supabase: SupabaseClient,
  user: User,
  messages: ChatMessage[],
  images?: ChatImageInput[],
): Promise<{
  reply: string;
  toolsUsed: string[];
  model?: string;
  keyLabel?: string;
  pendingConfirmation: PendingConfirmation | null;
}> {
  const apiKeys = getOrderedGeminiApiKeys();
  if (apiKeys.length === 0) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to .env to enable the chat agent.",
    );
  }

  const latest = messages[messages.length - 1];
  if (!latest || latest.role !== "user") {
    throw new Error("Last message must be from the user.");
  }

  const candidates = getGeminiModelCandidates();
  const failures: string[] = [];
  const ctx = { supabase, user };
  const latestParts = buildLatestUserParts(latest.content, images);

  for (const { key, label, index } of apiKeys) {
    const genAI = new GoogleGenerativeAI(key);
    let keyHadQuota = false;
    let keyHadAnyRetryable = false;

    for (const modelName of candidates) {
      try {
        const result = await runWithModel(
          genAI,
          modelName,
          ctx,
          messages,
          latestParts,
        );
        markGeminiKeySuccess(index);
        return {
          ...result,
          keyLabel: label,
        };
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unknown model error";
        failures.push(`[${label}/${modelName}]: ${detail}`);

        if (!isRetryableGeminiModelError(error)) {
          throw error;
        }

        keyHadAnyRetryable = true;
        if (isGeminiKeyExhaustedError(error)) {
          keyHadQuota = true;
        }
      }
    }

    if (keyHadQuota || keyHadAnyRetryable) {
      markGeminiKeyExhausted(index);
    }
  }

  throw new Error(
    `All Gemini keys/models failed. Tried keys: ${apiKeys.map((k) => k.label).join(", ")}; models: ${candidates.join(", ")}. Details: ${failures.join(" | ")}`,
  );
}

/** Execute a previously previewed write after UI confirmation. */
export async function confirmAgentWrite(
  supabase: SupabaseClient,
  user: User,
  tool: string,
  args: Record<string, unknown>,
): Promise<{ reply: string; toolsUsed: string[] }> {
  const result = await executeAgentTool(
    { supabase, user },
    tool,
    { ...args, confirmed: true },
  );

  if (
    result &&
    typeof result === "object" &&
    "error" in result &&
    typeof (result as { error: unknown }).error === "string"
  ) {
    throw new Error((result as { error: string }).error);
  }

  if (
    result &&
    typeof result === "object" &&
    (result as { status?: string }).status === "needs_confirmation"
  ) {
    throw new Error("Write still requires confirmation — try again.");
  }

  const summary =
    result &&
    typeof result === "object" &&
    "summary" in result &&
    typeof (result as { summary: unknown }).summary === "string"
      ? (result as { summary: string }).summary
      : "Change applied.";

  return {
    reply: `Confirmed — ${summary}`,
    toolsUsed: [tool],
  };
}
