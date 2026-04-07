"use client";

import { useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

// Shell mock data — replace with Convex queries in the next pass
const MOCK_LOGS = [
  {
    id: "1",
    timestamp: "Apr 7, 09:34",
    type: "keyword_match" as const,
    contact: "sarah_creates",
    rule: "Pricing inquiry",
    status: "delivered" as const,
    details: "Keyword 'price' matched. Reply sent successfully.",
  },
  {
    id: "2",
    timestamp: "Apr 7, 08:12",
    type: "story_reply" as const,
    contact: "dev_journal",
    rule: "Story reply follow-up",
    status: "delivered" as const,
    details: "Story reaction received. Contact enrolled in Welcome sequence.",
  },
  {
    id: "3",
    timestamp: "Apr 6, 22:48",
    type: "keyword_match" as const,
    contact: "luna_vibes",
    rule: "Link in bio",
    status: "failed" as const,
    details: "24-hour messaging window expired. Message not sent.",
  },
  {
    id: "4",
    timestamp: "Apr 6, 17:23",
    type: "sequence_step" as const,
    contact: "the_real_marco",
    rule: "Welcome sequence",
    status: "delivered" as const,
    details: "Step 2 of 2 sent. Sequence complete.",
  },
  {
    id: "5",
    timestamp: "Apr 6, 14:10",
    type: "webhook" as const,
    contact: null,
    rule: null,
    status: "received" as const,
    details: "Webhook verified. 3 events ingested.",
  },
  {
    id: "6",
    timestamp: "Apr 6, 12:05",
    type: "keyword_match" as const,
    contact: "coach_daniel",
    rule: "Pricing inquiry",
    status: "failed" as const,
    details: "Graph API error: (#10) Application does not have permission.",
  },
  {
    id: "7",
    timestamp: "Apr 6, 09:00",
    type: "sequence_step" as const,
    contact: "sarah_creates",
    rule: "Post-purchase follow-up",
    status: "delivered" as const,
    details: "Step 1 of 3 sent. Next step scheduled for Apr 8.",
  },
];

type FilterTab = "all" | "failures" | "webhooks";

const TYPE_LABELS: Record<string, string> = {
  keyword_match: "Keyword match",
  story_reply: "Story reply",
  sequence_step: "Sequence step",
  webhook: "Webhook event",
};

const STATUS_CONFIG = {
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    classes: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    classes: "text-destructive bg-destructive/5 border-destructive/20",
  },
  received: {
    label: "Received",
    icon: Radio,
    classes: "text-blue-700 bg-blue-50 border-blue-200",
  },
};

export default function LogsPage() {
  const [tab, setTab] = useState<FilterTab>("all");

  const filtered = MOCK_LOGS.filter((log) => {
    if (tab === "failures") return log.status === "failed";
    if (tab === "webhooks") return log.type === "webhook";
    return true;
  });

  const failureCount = MOCK_LOGS.filter((l) => l.status === "failed").length;

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automation events, delivery attempts, and webhook activity.
          </p>
        </div>

        {/* Failure banner */}
        {failureCount > 0 && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="size-4 text-destructive shrink-0" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{failureCount} failed</span>{" "}
              delivery attempt{failureCount !== 1 ? "s" : ""} in the last 24 hours.
            </p>
            <button
              onClick={() => setTab("failures")}
              className="ml-auto text-xs font-medium text-destructive hover:underline cursor-pointer shrink-0"
            >
              View failures
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0.5 bg-muted rounded-lg p-1 w-fit">
          {(
            [
              { value: "all", label: "All events" },
              { value: "failures", label: `Failures${failureCount > 0 ? ` (${failureCount})` : ""}` },
              { value: "webhooks", label: "Webhooks" },
            ] as { value: FilterTab; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                tab === value
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Log entries */}
        {filtered.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {filtered.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function LogRow({ log }: { log: (typeof MOCK_LOGS)[number] }) {
  const status = STATUS_CONFIG[log.status];
  const StatusIcon = status.icon;

  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
      {/* Status icon */}
      <StatusIcon
        className={cn("size-4 shrink-0 mt-0.5", log.status === "delivered" ? "text-emerald-600" : log.status === "failed" ? "text-destructive" : "text-blue-600")}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="text-sm font-medium text-foreground">
            {TYPE_LABELS[log.type]}
          </p>
          {log.contact && (
            <span className="text-xs text-muted-foreground">
              @{log.contact}
            </span>
          )}
          {log.rule && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground font-medium">
                {log.rule}
              </span>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {log.details}
        </p>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {log.timestamp}
        </div>
        <span
          className={cn(
            "text-xs font-medium rounded-full px-2 py-0.5 border",
            status.classes
          )}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: FilterTab }) {
  const messages: Record<FilterTab, { title: string; body: string }> = {
    all: {
      title: "No activity yet",
      body: "Automation events, webhook deliveries, and errors will appear here.",
    },
    failures: {
      title: "No failures",
      body: "All automation attempts have been delivered successfully.",
    },
    webhooks: {
      title: "No webhook events",
      body: "Inbound webhook events from Meta will appear here once your account is connected.",
    },
  };

  const msg = messages[tab];

  return (
    <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center text-center gap-2">
      <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
        <Activity className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mt-2">{msg.title}</p>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {msg.body}
      </p>
    </div>
  );
}
