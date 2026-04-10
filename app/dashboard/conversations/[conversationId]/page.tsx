"use client";

import { useParams } from "next/navigation";
import { InboxShell } from "@/components/dashboard/inbox-shell";
import type { Id } from "@/convex/_generated/dataModel";

export default function ConversationDetailPage() {
  const params = useParams<{ conversationId: string }>();

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col">
      <InboxShell
        routeConversationId={params.conversationId as Id<"conversations">}
      />
    </main>
  );
}
