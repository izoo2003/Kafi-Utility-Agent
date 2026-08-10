import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody } from "@/lib/api/parse";
import {
  confirmAgentWrite,
  runFacilityOpsAgent,
} from "@/lib/agent/run";
import { agentChatRequestSchema } from "@/lib/validations/agent";

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, agentChatRequestSchema);
  if (parsed.error) return parsed.error;

  try {
    if (parsed.data.confirmWrite) {
      const { reply, toolsUsed } = await confirmAgentWrite(
        supabase,
        user,
        parsed.data.confirmWrite.tool,
        parsed.data.confirmWrite.args,
      );
      return NextResponse.json({
        data: {
          message: { role: "assistant" as const, content: reply },
          toolsUsed,
          pendingConfirmation: null,
        },
      });
    }

    const { reply, toolsUsed, model, keyLabel, pendingConfirmation } =
      await runFacilityOpsAgent(
        supabase,
        user,
        parsed.data.messages,
        parsed.data.images,
      );
    return NextResponse.json({
      data: {
        message: { role: "assistant" as const, content: reply },
        toolsUsed,
        model,
        keyLabel,
        pendingConfirmation,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent request failed";
    const status = message.includes("GEMINI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
