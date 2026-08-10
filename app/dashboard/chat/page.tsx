import { PageHeader } from "@/components/dashboard/page-header";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Chat agent"
        description="Ask, attach photos to extract specs/logs, or edit records — changes preview first, then confirm."
        icon="chat"
        accent="slate"
      />
      <ChatPanel />
    </div>
  );
}
