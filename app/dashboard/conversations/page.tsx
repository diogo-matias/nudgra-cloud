"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Shell mock data — replace with Convex query in the next pass
const MOCK_CONVERSATIONS = [
  {
    id: "1",
    contact: { username: "sarah_creates", displayName: "Sarah M." },
    lastMessage: "Oh wow, that's amazing! Can you send me the full details?",
    timestamp: "2h ago",
    status: "active" as const,
    ruleTriggered: "Pricing inquiry",
    unread: true,
  },
  {
    id: "2",
    contact: { username: "luna_vibes", displayName: "Luna K." },
    lastMessage: "Here's our link! Check it out at the link in our bio.",
    timestamp: "4h ago",
    status: "active" as const,
    ruleTriggered: "Link in bio",
    unread: true,
  },
  {
    id: "3",
    contact: { username: "dev_journal", displayName: "Alex Chen" },
    lastMessage: "Sure, I'll fill out the form now. Thank you!",
    timestamp: "Yesterday",
    status: "complete" as const,
    ruleTriggered: "Collaboration request",
    unread: false,
  },
  {
    id: "4",
    contact: { username: "the_real_marco", displayName: "Marco V." },
    lastMessage: "Thanks for reaching out! Please fill out our collab form.",
    timestamp: "2 days ago",
    status: "complete" as const,
    ruleTriggered: "Link in bio",
    unread: false,
  },
  {
    id: "5",
    contact: { username: "coach_daniel", displayName: "Daniel R." },
    lastMessage: "Thanks for asking! DM me 'info' to get our pricing.",
    timestamp: "Mar 30",
    status: "expired" as const,
    ruleTriggered: "Pricing inquiry",
    unread: false,
  },
];

const STATUS_STYLES = {
  active: "text-emerald-700 bg-emerald-50 border-emerald-200",
  complete: "text-muted-foreground bg-muted border-border",
  expired: "text-amber-700 bg-amber-50 border-amber-200",
};

const STATUS_LABELS = {
  active: "Active",
  complete: "Complete",
  expired: "Window closed",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ConversationsPage() {
  const activeCount = MOCK_CONVERSATIONS.filter((c) => c.status === "active").length;

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-3xl w-full flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Conversations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} active · {MOCK_CONVERSATIONS.length} total
          </p>
        </div>

        {/* List */}
        {MOCK_CONVERSATIONS.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {MOCK_CONVERSATIONS.map((conv) => (
              <ConversationRow key={conv.id} conv={conv} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ConversationRow({
  conv,
}: {
  conv: (typeof MOCK_CONVERSATIONS)[number];
}) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer">
      {/* Avatar */}
      <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0 mt-0.5">
        {initials(conv.contact.displayName)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={cn("text-sm font-medium", conv.unread ? "text-foreground" : "text-muted-foreground")}>
            {conv.contact.displayName}
          </p>
          <span className="text-xs text-muted-foreground/60">
            @{conv.contact.username}
          </span>
        </div>
        <p
          className={cn(
            "text-sm truncate",
            conv.unread ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {conv.lastMessage}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Triggered by{" "}
          <span className="text-muted-foreground font-medium">
            {conv.ruleTriggered}
          </span>
        </p>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className="text-xs text-muted-foreground">{conv.timestamp}</p>
        <span
          className={cn(
            "text-xs font-medium rounded-full px-2 py-0.5 border",
            STATUS_STYLES[conv.status]
          )}
        >
          {STATUS_LABELS[conv.status]}
        </span>
        {conv.unread && (
          <span className="size-1.5 rounded-full bg-primary" />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center text-center gap-2">
      <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
        <MessageSquare className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mt-2">
        No conversations yet
      </p>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        Conversations will appear here once your automation rules start
        matching incoming messages.
      </p>
    </div>
  );
}
