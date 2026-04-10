"use client";

import { InboxShell } from "@/components/dashboard/inbox-shell";

export default function ConversationsPage() {
  return (
    <main className="flex h-full min-h-0 flex-1 flex-col">
      <InboxShell />
    </main>
  );
}
