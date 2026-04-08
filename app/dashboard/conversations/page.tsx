"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { MessageSquare } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

function initials(name: string | null, username: string | null) {
  const label = name || username || "IG";
  return label
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ConversationsPage() {
  const conversations = useQuery(api.dashboard.listConversations) ?? [];
  const activeCount = conversations.filter(
    (conversation) => conversation.status === "active",
  ).length;

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-3xl w-full flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Conversations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} active · {conversations.length} total
          </p>
        </div>

        {conversations.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/dashboard/conversations/${conversation.id}`}
                className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0 mt-0.5">
                  {initials(
                    conversation.contact.displayName,
                    conversation.contact.username,
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        conversation.unread ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {conversation.contact.displayName ?? "Instagram contact"}
                    </p>
                    <span className="text-xs text-muted-foreground/60">
                      @{conversation.contact.username ?? "unknown"}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-sm truncate",
                      conversation.unread ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {conversation.lastMessagePreview ?? "No message preview yet"}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {conversation.ruleName
                      ? `Triggered by ${conversation.ruleName}`
                      : "Waiting for a matched rule"}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(conversation.lastMessageAt)}
                  </p>
                  <span
                    className={cn(
                      "text-xs font-medium rounded-full px-2 py-0.5 border",
                      conversation.status === "active"
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : conversation.status === "window_closed"
                          ? "text-amber-700 bg-amber-50 border-amber-200"
                          : "text-muted-foreground bg-muted border-border"
                    )}
                  >
                    {conversation.status === "window_closed"
                      ? "Window closed"
                      : conversation.status === "active"
                        ? "Active"
                        : "Paused"}
                  </span>
                  {conversation.unread ? (
                    <span className="size-1.5 rounded-full bg-primary" />
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
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

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
