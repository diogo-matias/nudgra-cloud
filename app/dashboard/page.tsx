"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowRight,
  MessageSquare,
  Users,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  AccountAvatar,
  getAccountPrimaryLabel,
} from "@/components/dashboard/account-avatar";
import { Badge } from "@/components/ui/badge";

export default function OverviewPage() {
  const data = useQuery(api.dashboard.getOverview);
  const selectedAccount = data?.selectedAccount ?? null;
  const stats = data?.stats ?? {
    activeRules: 0,
    contacts: 0,
    conversations: 0,
    failuresToday: 0,
  };
  const selectedAccountLabel =
    selectedAccount === null
      ? null
      : getAccountPrimaryLabel({
          username: selectedAccount.username,
          name: selectedAccount.name,
          instagramAccountId: selectedAccount.instagramAccountId,
        });

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedAccount
              ? `Health and recent activity for ${
                  selectedAccount.username
                    ? `@${selectedAccount.username}`
                    : "the selected account"
                }.`
              : "Choose an active account from the sidebar to view scoped health and activity."}
          </p>
          {selectedAccountLabel ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-primary/15 bg-primary/5 text-primary"
              >
                Scoped to
              </Badge>
              <Badge variant="outline" className="border-border bg-background">
                {selectedAccountLabel}
              </Badge>
            </div>
          ) : null}
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active rules" value={String(stats.activeRules)} icon={Zap} />
          <StatCard label="Contacts" value={String(stats.contacts)} icon={Users} />
          <StatCard
            label="Conversations"
            value={String(stats.conversations)}
            icon={MessageSquare}
          />
          <StatCard
            label="Failures today"
            value={String(stats.failuresToday)}
            icon={AlertCircle}
            destructive
          />
        </div>

        {/* Main content */}
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          {/* Accounts */}
          <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Connected Accounts
              </h2>
              <Link
                href="/dashboard/account"
                className="text-xs font-medium text-primary transition hover:text-primary/80"
              >
                Manage
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {(data?.accounts.length ?? 0) === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No accounts connected
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connect an Instagram account to start automating.
                  </p>
                  <Link
                    href="/dashboard/account"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    Get started
                  </Link>
                </div>
              ) : (
                data?.accounts.map((account) => (
                  <div
                    key={account.id}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-4",
                      account.id === data.selectedAccount?.id
                        ? "border-primary/20 bg-primary/[0.04]"
                        : "border-border bg-background",
                    )}
                  >
                    <AccountAvatar
                      username={account.username}
                      name={account.name}
                      profilePictureUrl={account.profilePictureUrl}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {getAccountPrimaryLabel({
                            username: account.username,
                            name: account.name,
                            instagramAccountId: account.instagramAccountId,
                          })}
                        </p>
                        <StatusPill
                          reconnectRequired={account.reconnectRequired}
                          status={account.status}
                        />
                        {account.id === data.selectedAccount?.id && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Active
                          </span>
                        )}
                      </div>
                      {account.username ? (
                        <p className="text-xs text-muted-foreground">
                          @{account.username}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{account.activeRules} rules</span>
                        <span>{account.contacts} contacts</span>
                        <span>{account.conversations} conversations</span>
                      </div>
                      {account.lastError ? (
                        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                          {account.lastError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Quick links */}
            <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">
                Quick Links
              </h2>
              <div className="mt-3 space-y-2">
                <QuickLink
                  href="/dashboard/automations"
                  title="Automations"
                  icon={Zap}
                />
                <QuickLink
                  href="/dashboard/contacts"
                  title="Contacts"
                  icon={Users}
                />
                <QuickLink
                  href="/dashboard/conversations"
                  title="Conversations"
                  icon={MessageSquare}
                />
                <QuickLink
                  href="/dashboard/logs"
                  title="Logs"
                  icon={AlertCircle}
                />
              </div>
            </div>

            {/* Recent activity */}
            <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">
                Recent Activity
              </h2>
              <div className="mt-3 space-y-2">
                {(data?.recentActivity.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent activity yet.
                  </p>
                ) : (
                  data?.recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border bg-background px-3 py-2.5"
                    >
                      <p className="text-sm text-foreground">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatTimestamp(item.time)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatCard({
  label,
  value,
  icon: Icon,
  destructive,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  destructive?: boolean;
}) {
  const hasAlert = destructive && value !== "0";
  return (
    <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between">
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl",
            hasAlert ? "text-destructive" : "text-foreground",
          )}
        >
          {value}
        </p>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-xl",
            hasAlert ? "bg-destructive/10" : "bg-muted",
          )}
        >
          <Icon
            className={cn(
              "size-4",
              hasAlert ? "text-destructive" : "text-muted-foreground",
            )}
          />
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  icon: Icon,
}: {
  href: string;
  title: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 transition hover:bg-muted/40"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-3.5 text-primary" />
      </div>
      <p className="flex-1 text-sm font-medium text-foreground">{title}</p>
      <ArrowRight className="size-3.5 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}

function StatusPill({
  status,
  reconnectRequired,
}: {
  status: string;
  reconnectRequired: boolean;
}) {
  const styles =
    status === "disconnected"
      ? "border-border bg-muted text-muted-foreground"
      : reconnectRequired || status === "connection_error"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const label =
    status === "disconnected"
      ? "Disconnected"
      : reconnectRequired || status === "connection_error"
        ? "Reconnect"
        : "Connected";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
        styles,
      )}
    >
      {label}
    </span>
  );
}
