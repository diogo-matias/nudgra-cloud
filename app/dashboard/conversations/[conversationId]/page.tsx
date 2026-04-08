"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function ConversationDetailPage() {
  const params = useParams<{ conversationId: string }>();
  const conversation = useQuery(api.dashboard.getConversationDetail, {
    conversationId: params.conversationId as Id<"conversations">,
  });

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-3xl w-full flex flex-col gap-6">
        <Link
          href="/dashboard/conversations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="size-3.5" />
          Back to conversations
        </Link>

        {conversation === undefined ? (
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Loading conversation...
          </div>
        ) : conversation === null ? (
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Conversation not found.
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {conversation.contact.displayName ?? "Instagram contact"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  @{conversation.contact.username ?? "unknown"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {conversation.contact.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
                  >
                    {tag.label}
                  </span>
                ))}
                {conversation.sequences.map((sequence) => (
                  <span
                    key={sequence.id}
                    className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary"
                  >
                    {sequence.name}: {sequence.status}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Messaging window:{" "}
                {conversation.messagingWindowClosesAt
                  ? formatDateTime(conversation.messagingWindowClosesAt)
                  : "Unknown"}
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {conversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`px-5 py-4 flex ${
                    message.direction === "outbound" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      message.direction === "outbound"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">
                      {message.text ?? "Instagram event"}
                    </p>
                    <p
                      className={`text-[11px] mt-2 ${
                        message.direction === "outbound"
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatDateTime(message.eventTime)} · {message.source}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
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
