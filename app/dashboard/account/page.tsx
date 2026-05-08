"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Unplug,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  AccountAvatar,
  getAccountPrimaryLabel,
} from "@/components/dashboard/account-avatar";

function formatDateTime(timestamp: number | null) {
  if (timestamp === null) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getConnectionState(args: {
  status: string;
  reconnectRequired: boolean;
}) {
  if (args.status === "disconnected") {
    return {
      label: "Disconnected",
      classes: "border-border bg-muted text-muted-foreground",
    };
  }

  if (args.reconnectRequired || args.status === "connection_error") {
    return {
      label: "Reconnect required",
      classes: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  return {
    label: "Connected",
    classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

export default function AccountPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({});
  const requestedAvatarRefreshIdsRef = useRef(new Set<string>());
  const context = useQuery(api.accounts.getSelectedAccountContext);
  const list = useQuery(api.accounts.listWorkspaceAccounts, { search });
  const selectAccount = useMutation(api.accounts.selectAccount);
  const disconnectAccount = useMutation(api.accounts.disconnectAccount);
  const refreshAccountProfile = useAction(api.accounts.refreshAccountProfile);

  const selectedAccount = context?.selectedAccount ?? null;
  const accounts = list?.accounts ?? [];
  const totalAccounts = context?.totalAccounts ?? 0;
  const connectedAccounts = context?.connectedAccounts ?? 0;

  const banners = [
    searchParams.get("error")
      ? {
          tone: "error" as const,
          message: decodeURIComponent(searchParams.get("error") ?? ""),
        }
      : null,
    searchParams.get("warning")
      ? {
          tone: "warning" as const,
          message: decodeURIComponent(searchParams.get("warning") ?? ""),
        }
      : null,
    searchParams.get("connected")
      ? {
          tone: "success" as const,
          message: "Instagram account connected and set as active.",
        }
      : null,
  ].filter((banner): banner is { tone: "success" | "warning" | "error"; message: string } => banner !== null);

  const requestAvatarRefresh = (accountId: Id<"instagramAccounts">) => {
    if (requestedAvatarRefreshIdsRef.current.has(accountId)) {
      return;
    }

    requestedAvatarRefreshIdsRef.current.add(accountId);
    setRefreshingIds((current) => ({
      ...current,
      [accountId]: true,
    }));
    void refreshAccountProfile({ accountId })
      .catch(() => {
        requestedAvatarRefreshIdsRef.current.delete(accountId);
      })
      .finally(() => {
        setRefreshingIds((current) => ({
          ...current,
          [accountId]: false,
        }));
      });
  };

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Manage Accounts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect Instagram accounts and set the active workspace scope.
            </p>
          </div>
          <Link
            href="/api/meta/connect"
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="size-4" />
            Add account
          </Link>
        </header>

        {/* Banners */}
        {banners.map((banner) => (
          <StatusBanner
            key={`${banner.tone}:${banner.message}`}
            tone={banner.tone}
            message={banner.message}
          />
        ))}

        {/* Content */}
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          {/* Account list */}
          <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{connectedAccounts}</span> of{" "}
                <span className="font-medium text-foreground">{totalAccounts}</span>{" "}
                account{totalAccounts === 1 ? "" : "s"} connected
              </p>
              <label className="relative block w-full sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search accounts"
                  className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
            </div>

            <div className="mt-4 space-y-3">
              {accounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No accounts found
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connect your first Instagram professional account to get started.
                  </p>
                </div>
              ) : (
                accounts.map((account) => {
                  const state = getConnectionState({
                    status: account.status,
                    reconnectRequired: account.reconnectRequired,
                  });
                  const isRefreshing = Boolean(refreshingIds[account.id]);
                  const isDisconnected = account.status === "disconnected";

                  return (
                    <article
                      key={account.id}
                      className={cn(
                        "rounded-2xl border p-4 transition",
                        account.isSelected
                          ? "border-primary/20 bg-primary/[0.04]"
                          : "border-border bg-background",
                      )}
                    >
                      {/* Top row: avatar + info */}
                      <div className="flex items-start gap-3">
                        <AccountAvatar
                          username={account.username}
                          name={account.name}
                          profilePictureUrl={account.profilePictureUrl}
                          size="md"
                          onImageError={() => requestAvatarRefresh(account.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-semibold text-foreground">
                              {getAccountPrimaryLabel({
                                username: account.username,
                                name: account.name,
                                instagramAccountId: account.instagramAccountId,
                              })}
                            </h2>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                state.classes,
                              )}
                            >
                              {state.label}
                            </span>
                            {account.isSelected ? (
                              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Active scope
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {account.username
                              ? `@${account.username}`
                              : account.instagramAccountId}
                          </p>
                          {/* Metadata */}
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Connected {formatDateTime(account.connectedAt)}</span>
                            <span>Token {formatDateTime(account.nextRefreshAt)}</span>
                            <span>Webhook {formatDateTime(account.lastWebhookAt)}</span>
                          </div>
                          {account.lastError ? (
                            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs leading-relaxed text-amber-900">
                              {account.lastError}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {/* Action row */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        <button
                          type="button"
                          disabled={account.isSelected || isDisconnected}
                          onClick={() =>
                            void selectAccount({ accountId: account.id })
                          }
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Set active
                        </button>
                        <button
                          type="button"
                          disabled={isRefreshing || isDisconnected}
                          onClick={() => {
                            setRefreshingIds((current) => ({
                              ...current,
                              [account.id]: true,
                            }));
                            void refreshAccountProfile({
                              accountId: account.id,
                            }).finally(() => {
                              setRefreshingIds((current) => ({
                                ...current,
                                [account.id]: false,
                              }));
                            });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RefreshCw
                            className={cn(
                              "size-3.5",
                              isRefreshing && "animate-spin",
                            )}
                          />
                          Refresh
                        </button>
                        <Link
                          href="/api/meta/connect"
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                        >
                          Reconnect
                        </Link>
                        <button
                          type="button"
                          disabled={isDisconnected}
                          onClick={() =>
                            void disconnectAccount({ accountId: account.id })
                          }
                          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Unplug className="size-3.5" />
                          Disconnect
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          {/* Aside */}
          <aside className="space-y-4">
            {/* Active account summary */}
            <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Active account
              </p>
              {selectedAccount ? (
                <div className="mt-4 flex items-start gap-3">
                  <AccountAvatar
                    username={selectedAccount.username}
                    name={selectedAccount.name}
                    profilePictureUrl={selectedAccount.profilePictureUrl}
                    size="md"
                    onImageError={() => requestAvatarRefresh(selectedAccount.id)}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {getAccountPrimaryLabel({
                        username: selectedAccount.username,
                        name: selectedAccount.name,
                        instagramAccountId: selectedAccount.instagramAccountId,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedAccount.username
                        ? `@${selectedAccount.username}`
                        : selectedAccount.instagramAccountId}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      Sets the workspace scope for automations, contacts,
                      conversations, logs, and media.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  No connected account is currently active.
                </p>
              )}
            </div>

            {/* Required permissions */}
            <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Required permissions
              </p>
              <div className="mt-3 space-y-2.5">
                {[
                  {
                    scope: "instagram_business_basic",
                    desc: "Read profile and media",
                  },
                  {
                    scope: "instagram_business_manage_messages",
                    desc: "Receive and send DMs",
                  },
                  {
                    scope: "instagram_business_manage_comments",
                    desc: "Comment automation triggers",
                  },
                ].map(({ scope, desc }) => (
                  <div key={scope} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-medium text-foreground">{scope}</p>
                      <p className="text-[11px] text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning */}
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <div>
                  <p className="text-xs font-semibold text-amber-950">
                    Account isolation
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900">
                    Rules, contacts, conversations, logs, and webhooks are
                    scoped to the active account. Switching accounts changes the
                    UI scope without mixing data.
                  </p>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Token errors?
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Use <strong>Reconnect</strong> to re-authorize via Instagram
                    OAuth and restore webhook delivery.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StatusBanner({
  tone,
  message,
}: {
  tone: "success" | "warning" | "error";
  message: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "error" && "border-destructive/20 bg-destructive/5 text-foreground",
      )}
    >
      {message}
    </div>
  );
}
