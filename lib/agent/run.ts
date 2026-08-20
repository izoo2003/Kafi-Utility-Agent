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
import type { ChatAttachmentInput } from "@/lib/validations/agent";
import {
  GROUNDING_NUDGE,
  shouldRequireLiveLookup,
  wrapToolResult,
} from "@/lib/agent/grounding";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_TOOL_ROUNDS = 10;

function toGeminiHistory(messages: ChatMessage[]): Content[] {
  const prior = messages.slice(0, -1);
  return prior.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content || "(empty)" }],
  }));
}

function buildLatestUserParts(
  text: string,
  attachments: ChatAttachmentInput[] | undefined,
): string | Part[] {
  const trimmed = text.trim();
  const defaultText =
    trimmed ||
    (attachments?.length
      ? "Analyze every attached image/PDF page. Extract each log/expense/spec row separately and call the matching create tools with confirmed=false (one call per row). Prefer generator fuel vs maintenance vs solar based on the document and my prompt."
      : "");

  if (!attachments?.length) {
    return defaultText;
  }

  const parts: Part[] = [{ text: defaultText }];
  for (const file of attachments) {
    parts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data,
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
  hasAttachments: boolean,
): Promise<{
  reply: string;
  toolsUsed: string[];
  model: string;
  pendingConfirmations: PendingConfirmation[];
}> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: agentSystemPrompt,
    tools: [{ functionDeclarations: agentTools }],
    generationConfig: {
      temperature: 0.2,
    },
  });

  const chat = model.startChat({
    history: toGeminiHistory(messages),
  });

  const toolsUsed: string[] = [];
  const pendingConfirmations: PendingConfirmation[] = [];
  const userText = messages[messages.length - 1]?.content ?? "";
  let nudgedForGrounding = false;
  let result = await chat.sendMessage(latestParts);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const functionCalls = result.response.functionCalls();

    if (!functionCalls?.length) {
      if (
        !nudgedForGrounding &&
        toolsUsed.length === 0 &&
        shouldRequireLiveLookup(userText, hasAttachments)
      ) {
        nudgedForGrounding = true;
        result = await chat.sendMessage(GROUNDING_NUDGE);
        continue;
      }
      const text = result.response.text()?.trim();
      return {
        reply:
          text ||
          (pendingConfirmations.length
            ? `Found ${pendingConfirmations.length} record${pendingConfirmations.length === 1 ? "" : "s"} ready to review. Use Confirm, Confirm all, or Leave below.`
            : "I couldn’t produce a response. Try asking again."),
        toolsUsed,
        model: modelName,
        pendingConfirmations,
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
          { allowConfirm: false },
        );
        const pending = extractPendingConfirmation(toolResult);
        if (pending) {
          pendingConfirmations.push(pending);
        }
        responseParts.push({
          functionResponse: {
            name: call.name,
            response: wrapToolResult(toolResult),
          },
        });
      } catch (error) {
        responseParts.push({
          functionResponse: {
            name: call.name,
            response: {
              source: "site_database",
              error:
                error instanceof Error
                  ? error.message
                  : "Tool execution failed",
            },
          },
        });
      }
    }

    // Stop as soon as writes need UI confirmation — do not let the model
    // continue and attempt confirmed=true on its own.
    if (pendingConfirmations.length > 0) {
      return {
        reply: `Found ${pendingConfirmations.length} record${pendingConfirmations.length === 1 ? "" : "s"} from your file. Nothing is saved yet — use Confirm (one), Confirm all, or Leave below.`,
        toolsUsed,
        model: modelName,
        pendingConfirmations,
      };
    }

    result = await chat.sendMessage(responseParts);
  }

  return {
    reply: pendingConfirmations.length
      ? `Found ${pendingConfirmations.length} record${pendingConfirmations.length === 1 ? "" : "s"} ready to review. Use Confirm, Confirm all, or Leave below.`
      : "I hit the tool-call limit while looking that up. Ask a narrower question, or try again.",
    toolsUsed,
    model: modelName,
    pendingConfirmations,
  };
}

export async function runFacilityOpsAgent(
  supabase: SupabaseClient,
  user: User,
  messages: ChatMessage[],
  attachments?: ChatAttachmentInput[],
): Promise<{
  reply: string;
  toolsUsed: string[];
  model?: string;
  keyLabel?: string;
  pendingConfirmation: PendingConfirmation | null;
  pendingConfirmations: PendingConfirmation[];
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
  const latestParts = buildLatestUserParts(latest.content, attachments);

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
          Boolean(attachments?.length),
        );
        markGeminiKeySuccess(index);
        return {
          ...result,
          keyLabel: label,
          pendingConfirmation: result.pendingConfirmations[0] ?? null,
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
    { allowConfirm: true },
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
