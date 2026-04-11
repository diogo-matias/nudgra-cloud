"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InboxShell } from "@/components/dashboard/inbox-shell";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";

export default function ConversationsPage() {
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;

  if (selectedAccount === null) {
    return (
      <main className="flex h-full min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active Instagram account from the sidebar before opening conversations."
        />
      </main>
    );
  }

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col">
      <InboxShell accountId={selectedAccount.id} />
    </main>
  );
}
