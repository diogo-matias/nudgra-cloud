"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FilterTab = "all" | "failures" | "webhooks";
type LogStatus =
  | "sent"
  | "failed"
  | "queued"
  | "skipped"
  | "skipped_expired"
  | "blocked_auth"
  | "received";

const ISSUE_STATUSES = new Set<LogStatus>([
  "failed",
  "blocked_auth",
  "skipped",
  "skipped_expired",
]);

const STATUS_CONFIG: Record<
  LogStatus,
  {
    label: string;
    icon: LucideIcon;
    classes: string;
  }
> = {
  sent: {
    label: "Delivered",
    icon: CheckCircle2,
    classes: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    classes: "text-destructive bg-destructive/5 border-destructive/20",
  },
  queued: {
    label: "Queued",
    icon: Clock,
    classes: "text-blue-700 bg-blue-50 border-blue-200",
  },
  blocked_auth: {
    label: "Blocked",
    icon: AlertCircle,
    classes: "text-amber-700 bg-amber-50 border-amber-200",
  },
  skipped: {
    label: "Skipped",
    icon: AlertCircle,
    classes: "text-amber-700 bg-amber-50 border-amber-200",
  },
  skipped_expired: {
    label: "Window expired",
    icon: Clock,
    classes: "text-amber-700 bg-amber-50 border-amber-200",
  },
  received: {
    label: "Received",
    icon: Radio,
    classes: "text-blue-700 bg-blue-50 border-blue-200",
  },
};

const LOG_TYPE_LABELS: Record<string, string> = {
  keyword_match: "Keyword match",
  sequence_step: "Sequence step",
  webhook: "Webhook",
  webhook_delivery: "Webhook delivery",
  comment_guardrail: "Comment guardrail",
};

function isIssueStatus(status: LogStatus) {
  return ISSUE_STATUSES.has(status);
}

function formatLogType(value: string) {
  return (
    LOG_TYPE_LABELS[value] ??
    value
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ")
  );
}

function formatPayload(payload: string) {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

export default function LogsPage() {
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;
  const [tab, setTab] = useState<FilterTab>("all");
  const logs =
    useQuery(
      api.dashboard.listLogs,
      selectedAccount ? { accountId: selectedAccount.id } : "skip",
    ) ?? [];

  if (selectedAccount === null) {
    return (
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active Instagram account from the sidebar before opening logs."
        />
      </main>
    );
  }

  const filtered = logs.filter((log) => {
    if (tab === "failures") {
      return isIssueStatus(log.status);
    }
    if (tab === "webhooks") {
      return log.type.startsWith("webhook");
    }
    return true;
  });

  const failureCount = logs.filter((log) => isIssueStatus(log.status)).length;

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automation events, delivery attempts, and webhook activity for{" "}
            {selectedAccount.username ? `@${selectedAccount.username}` : "the active account"}.
          </p>
        </div>

        {failureCount > 0 ? (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="size-4 text-destructive shrink-0" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{failureCount} delivery</span>{" "}
              issue{failureCount !== 1 ? "s" : ""} in recent activity.
            </p>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setTab("failures")}
              className="ml-auto h-auto shrink-0 p-0 text-destructive"
            >
              View failures
            </Button>
          </div>
        ) : null}

        <div className="flex gap-0.5 bg-muted rounded-lg p-1 w-fit">
          {(
            [
              { value: "all", label: "All events" },
              {
                value: "failures",
                label: `Failures${failureCount > 0 ? ` (${failureCount})` : ""}`,
              },
              { value: "webhooks", label: "Webhooks" },
            ] as { value: FilterTab; label: string }[]
          ).map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              variant={tab === value ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "rounded-md px-4",
                tab === value && "border border-border bg-card shadow-sm"
              )}
            >
              {label}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {filtered.map((log) => {
              const status = STATUS_CONFIG[log.status];
              const StatusIcon = status.icon;
              const issueStatus = isIssueStatus(log.status);
              const formattedPayload =
                log.rawPayload === null ? null : formatPayload(log.rawPayload);

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <StatusIcon className="size-4 shrink-0 mt-0.5 text-muted-foreground" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {formatLogType(log.type)}
                      </p>
                      {log.contact ? (
                        <span className="text-xs text-muted-foreground">
                          @{log.contact}
                        </span>
                      ) : null}
                      {log.rule ? (
                        <span className="text-xs text-muted-foreground font-medium">
                          {log.rule}
                        </span>
                      ) : null}
                      {log.attemptNumber !== null && log.attemptNumber > 1 ? (
                        <Badge
                          variant="outline"
                          className="border-border bg-background text-muted-foreground"
                        >
                          Attempt {log.attemptNumber}
                        </Badge>
                      ) : null}
                    </div>
                    {issueStatus ? (
                      <div className="mt-2 rounded-xl border border-border bg-muted/20 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          What happened
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-foreground">
                          {log.details}
                        </p>
                        {log.metaError || formattedPayload ? (
                          <div className="mt-2 space-y-2">
                            {log.metaError ? (
                              <div className="flex flex-wrap gap-1.5">
                                {log.metaError.code !== null ? (
                                  <Badge
                                    variant="outline"
                                    className="border-border bg-background text-muted-foreground"
                                  >
                                    Meta code {log.metaError.code}
                                  </Badge>
                                ) : null}
                                {log.metaError.subcode !== null ? (
                                  <Badge
                                    variant="outline"
                                    className="border-border bg-background text-muted-foreground"
                                  >
                                    Subcode {log.metaError.subcode}
                                  </Badge>
                                ) : null}
                                {log.metaError.type ? (
                                  <Badge
                                    variant="outline"
                                    className="border-border bg-background text-muted-foreground"
                                  >
                                    {log.metaError.type}
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                            {formattedPayload ? (
                              <details className="group">
                                <summary className="cursor-pointer text-xs font-medium text-muted-foreground transition group-open:text-foreground">
                                  Raw Meta response
                                </summary>
                                <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-border bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
                                  {formattedPayload}
                                </pre>
                              </details>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {log.details}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {formatDateTime(log.time)}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        status.classes
                      )}
                    >
                      {status.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState({ tab }: { tab: FilterTab }) {
  const messages: Record<FilterTab, { title: string; body: string }> = {
    all: {
      title: "No activity yet",
      body: "Automation events, webhook deliveries, and errors will appear here.",
    },
    failures: {
      title: "No delivery issues",
      body: "Recent sends and retries are healthy for the selected account.",
    },
    webhooks: {
      title: "No webhook events",
      body: "Inbound webhook events from Meta will appear here once the account is connected and the Meta webhook callback is configured correctly.",
    },
  };

  const message = messages[tab];

  return (
    <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center text-center gap-2">
      <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
        <Activity className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mt-2">{message.title}</p>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {message.body}
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
