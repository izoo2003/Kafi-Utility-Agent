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
    const batch =
      parsed.data.confirmWrites?.length
        ? parsed.data.confirmWrites
        : parsed.data.confirmWrite
          ? [parsed.data.confirmWrite]
          : null;

    if (batch) {
      const toolsUsed: string[] = [];
      const replies: string[] = [];
      let failedAt: number | null = null;
      let failMessage: string | null = null;

      for (let i = 0; i < batch.length; i++) {
        const item = batch[i]!;
        try {
          const { reply, toolsUsed: used } = await confirmAgentWrite(
            supabase,
            user,
            item.tool,
            item.args,
          );
          toolsUsed.push(...used);
          replies.push(reply);
        } catch (error) {
          failedAt = i;
          failMessage =
            error instanceof Error ? error.message : "Confirm failed";
          break;
        }
      }

      const okCount = replies.length;
      const total = batch.length;
      const summary =
        failedAt == null
          ? total === 1
            ? replies[0]!
            : `Confirmed all ${total} records.`
          : okCount === 0
            ? `Confirm failed: ${failMessage}`
            : `Confirmed ${okCount} of ${total} records, then failed: ${failMessage}`;

      return NextResponse.json(
        {
          data: {
            message: { role: "assistant" as const, content: summary },
            toolsUsed,
            confirmedCount: okCount,
            pendingConfirmation: null,
            pendingConfirmations: [],
          },
        },
        { status: failedAt === 0 ? 500 : 200 },
      );
    }

    const attachments = [
      ...(parsed.data.attachments ?? []),
      ...(parsed.data.images ?? []),
    ].slice(0, 8);

    const {
      reply,
      toolsUsed,
      model,
      keyLabel,
      pendingConfirmation,
      pendingConfirmations,
    } = await runFacilityOpsAgent(
      supabase,
      user,
      parsed.data.messages,
      attachments,
    );
    return NextResponse.json({
      data: {
        message: { role: "assistant" as const, content: reply },
        toolsUsed,
        model,
        keyLabel,
        pendingConfirmation,
        pendingConfirmations,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent request failed";
    const status = message.includes("GEMINI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
