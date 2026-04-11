"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Activity, AlertCircle, CheckCircle2, Clock, Radio } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";

type FilterTab = "all" | "failures" | "webhooks";

const STATUS_CONFIG = {
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
  skipped: {
    label: "Skipped",
    icon: AlertCircle,
    classes: "text-amber-700 bg-amber-50 border-amber-200",
  },
  received: {
    label: "Received",
    icon: Radio,
    classes: "text-blue-700 bg-blue-50 border-blue-200",
  },
};

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
      return log.status === "failed";
    }
    if (tab === "webhooks") {
      return log.type.startsWith("webhook");
    }
    return true;
  });

  const failureCount = logs.filter((log) => log.status === "failed").length;

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
              <span className="font-semibold">{failureCount} failed</span>{" "}
              delivery attempt{failureCount !== 1 ? "s" : ""} in recent activity.
            </p>
            <button
              type="button"
              onClick={() => setTab("failures")}
              className="ml-auto text-xs font-medium text-destructive hover:underline cursor-pointer shrink-0"
            >
              View failures
            </button>
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
            <button
              key={value}
              type="button"
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

        {filtered.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {filtered.map((log) => {
              const status =
                STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] ??
                STATUS_CONFIG.received;
              const StatusIcon = status.icon;

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <StatusIcon className="size-4 shrink-0 mt-0.5 text-muted-foreground" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {log.type.replace("_", " ")}
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
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {log.details}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {formatDateTime(log.time)}
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
      title: "No failures",
      body: "All recent automation attempts have been delivered successfully.",
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
