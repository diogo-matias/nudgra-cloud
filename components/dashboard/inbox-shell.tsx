"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ExternalLink,
  Filter,
  MessageSquare,
  Search,
  Sparkles,
  Tag,
  TimerReset,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ContactAvatar,
  getContactDisplayName,
  getInstagramHandle,
  getInstagramProfileUrl,
} from "@/components/dashboard/contact-avatar";
import { StatusPill } from "@/components/dashboard/status-pill";
import { formatDateTime, formatRelativeTime } from "@/lib/dashboard-formatters";
import { cn } from "@/lib/utils";

/* ─── helpers ─── */

function sourceLabel(
  source:
    | "rule"
    | "comment_automation"
    | "story_automation"
    | "follower_automation"
    | "sequence",
) {
  if (source === "comment_automation") return "Comment automation";
  if (source === "story_automation") return "Story automation";
  if (source === "follower_automation") return "Follower automation";
  if (source === "sequence") return "Sequence";
  return "Rule";
}

const MESSAGE_LIST_BOTTOM_OFFSET_PX = 80;

function isScrolledNearBottom(element: HTMLDivElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    MESSAGE_LIST_BOTTOM_OFFSET_PX
  );
}

/* ─── main shell ─── */

export function InboxShell({
  accountId,
  routeConversationId = null,
}: {
  accountId: Id<"instagramAccounts">;
  routeConversationId?: Id<"conversations"> | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "window_closed" | "paused"
  >("all");
  const [showFilters, setShowFilters] = useState(false);

  const requestedRefreshIdsRef = useRef(new Set<string>());
  const requestedHistorySyncIdsRef = useRef(new Set<string>());
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const renderedConversationIdRef = useRef<Id<"conversations"> | null>(null);
  const renderedMessageCountRef = useRef(0);

  const requestContactProfileRefresh = useMutation(
    api.contacts.requestContactProfileRefresh,
  );
  const syncConversationHistory = useAction(
    api.meta.history.syncConversationHistory,
  );

  const inbox = useQuery(api.inbox.listInbox, {
    accountId,
    unreadOnly,
    statusFilter,
    search,
  });

  const selectedConversationId = useMemo(() => {
    if (routeConversationId) return routeConversationId;
    return inbox?.[0]?.id ?? null;
  }, [inbox, routeConversationId]);

  const detail = useQuery(
    api.inbox.getConversationDetail,
    selectedConversationId
      ? { accountId, conversationId: selectedConversationId }
      : "skip",
  );
  const hasConversationDetail = detail !== undefined && detail !== null;
  const detailId = hasConversationDetail ? detail.id : null;
  const detailMessageCount = hasConversationDetail ? detail.messages.length : 0;
  const hasExplicitRoute = routeConversationId !== null;

  const hasActiveFilters = unreadOnly || statusFilter !== "all";

  /* ── side effects (unchanged logic) ── */

  useEffect(() => {
    const missingProfiles = (inbox ?? [])
      .filter(
        (c) =>
          c.contact.profilePictureUrl === null &&
          !requestedRefreshIdsRef.current.has(c.contact.id),
      )
      .slice(0, 12);
    for (const c of missingProfiles) {
      requestedRefreshIdsRef.current.add(c.contact.id);
      void requestContactProfileRefresh({
        accountId,
        contactId: c.contact.id,
      });
    }
  }, [accountId, inbox, requestContactProfileRefresh]);

  useEffect(() => {
    if (!detail?.contact || detail.contact.profilePictureUrl !== null) return;
    if (requestedRefreshIdsRef.current.has(detail.contact.id)) return;
    requestedRefreshIdsRef.current.add(detail.contact.id);
    void requestContactProfileRefresh({
      accountId,
      contactId: detail.contact.id,
    });
  }, [accountId, detail, requestContactProfileRefresh]);

  useEffect(() => {
    if (!selectedConversationId) return;
    if (requestedHistorySyncIdsRef.current.has(selectedConversationId)) return;
    requestedHistorySyncIdsRef.current.add(selectedConversationId);
    void syncConversationHistory({
      conversationId: selectedConversationId,
    }).catch((error: unknown) => {
      console.error("Failed to sync Instagram conversation history", error);
      requestedHistorySyncIdsRef.current.delete(selectedConversationId);
    });
  }, [selectedConversationId, syncConversationHistory]);

  useEffect(() => {
    if (!hasConversationDetail || detailId === null) {
      renderedConversationIdRef.current = null;
      renderedMessageCountRef.current = 0;
      return;
    }
    const conversationChanged = renderedConversationIdRef.current !== detailId;
    const messageCountChanged =
      renderedMessageCountRef.current !== detailMessageCount;
    renderedConversationIdRef.current = detailId;
    renderedMessageCountRef.current = detailMessageCount;
    if (
      !conversationChanged &&
      !(messageCountChanged && shouldStickToBottomRef.current)
    )
      return;
    const raf = window.requestAnimationFrame(() => {
      const vp = messagesViewportRef.current;
      if (!vp) return;
      vp.scrollTop = vp.scrollHeight;
      shouldStickToBottomRef.current = true;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [detailId, detailMessageCount, hasConversationDetail]);

  /* ── render ── */

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* ─── two-column layout ─── */}
      <div className="flex min-h-0 flex-1">
        {/* ════════════════════════════════════════════
            LEFT: Conversation list
           ════════════════════════════════════════════ */}
        <aside
          className={cn(
            "flex w-full flex-col border-r border-border bg-card lg:w-[380px] lg:shrink-0",
            hasExplicitRoute ? "hidden lg:flex" : "flex",
          )}
        >
          {/* list header */}
          <div className="flex flex-col gap-3 border-b border-border px-4 pb-3 pt-5">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Conversations
              </h1>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  "relative inline-flex size-8 items-center justify-center rounded-lg transition",
                  showFilters || hasActiveFilters
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Filter className="size-4" />
                {hasActiveFilters && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary" />
                )}
              </button>
            </div>

            {/* search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* filters row */}
            {showFilters && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUnreadOnly((v) => !v)}
                  className={cn(
                    "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition",
                    unreadOnly
                      ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  Unread
                </button>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as
                        | "all"
                        | "active"
                        | "window_closed"
                        | "paused",
                    )
                  }
                  className="h-7 rounded-md border-none bg-muted px-2 text-xs font-medium text-muted-foreground outline-none transition hover:text-foreground focus:ring-1 focus:ring-primary/20"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="window_closed">Window closed</option>
                  <option value="paused">Paused</option>
                </select>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setUnreadOnly(false);
                      setStatusFilter("all");
                    }}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* list body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {inbox === undefined ? (
              <ListState text="Loading..." />
            ) : inbox.length === 0 ? (
              <ListState text="No conversations found." />
            ) : (
              <div className="divide-y divide-border/60">
                {inbox.map((conversation) => {
                  const isSelected = conversation.id === selectedConversationId;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/dashboard/conversations/${conversation.id}`,
                        )
                      }
                      className={cn(
                        "group flex w-full gap-3 px-4 py-3 text-left transition-colors",
                        isSelected ? "bg-primary/[0.06]" : "hover:bg-muted/50",
                      )}
                    >
                      <ContactAvatar
                        displayName={conversation.contact.displayName}
                        username={conversation.contact.username}
                        profilePictureUrl={
                          conversation.contact.profilePictureUrl
                        }
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-sm",
                              conversation.unread
                                ? "font-semibold text-foreground"
                                : "font-medium text-foreground/80",
                            )}
                          >
                            {getContactDisplayName(
                              conversation.contact.displayName,
                              conversation.contact.username,
                            )}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {formatRelativeTime(conversation.lastMessageAt)}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "mt-0.5 truncate text-[13px] leading-snug",
                            conversation.unread
                              ? "text-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {conversation.lastMessagePreview ?? "No messages yet"}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <StatusPill
                            status={conversation.status}
                            className="py-0.5 text-[10px]"
                          />
                          {conversation.latestAutomationContext && (
                            <span className="inline-flex max-w-[160px] items-center truncate rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {conversation.latestAutomationContext.label}
                            </span>
                          )}
                          {conversation.unread && (
                            <span className="ml-auto size-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ════════════════════════════════════════════
            RIGHT: Conversation detail
           ════════════════════════════════════════════ */}
        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col bg-background",
            hasExplicitRoute ? "flex" : "hidden lg:flex",
          )}
        >
          {selectedConversationId === null ? (
            <DetailPlaceholder />
          ) : detail === undefined ? (
            <DetailState text="Loading conversation..." />
          ) : detail === null ? (
            <DetailState text="Conversation not found." />
          ) : (
            <>
              {/* ── detail header ── */}
              <div className="border-b border-border bg-card px-5 py-3">
                {hasExplicitRoute && (
                  <Link
                    href="/dashboard/conversations"
                    className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground lg:hidden"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Link>
                )}

                <div className="flex items-start justify-between gap-4">
                  {/* left: contact info */}
                  <div className="flex min-w-0 items-center gap-3">
                    <ContactAvatar
                      displayName={detail.contact.displayName}
                      username={detail.contact.username}
                      profilePictureUrl={detail.contact.profilePictureUrl}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-foreground">
                          {getContactDisplayName(
                            detail.contact.displayName,
                            detail.contact.username,
                          )}
                        </h2>
                        {getInstagramProfileUrl(detail.contact.username) && (
                          <a
                            href={
                              getInstagramProfileUrl(detail.contact.username)!
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-muted-foreground transition hover:text-foreground"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                      {getInstagramHandle(detail.contact.username) && (
                        <p className="text-xs text-muted-foreground">
                          {getInstagramHandle(detail.contact.username)}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusPill status={detail.status} />
                        {detail.unread && (
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            Unread
                          </span>
                        )}
                        {detail.messagingWindowClosesAt && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <TimerReset className="size-3" />
                            {formatRelativeTime(detail.messagingWindowClosesAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* right: automation context card */}
                  {detail.latestAutomationContext && (
                    <div className="hidden shrink-0 rounded-xl border border-border bg-muted/30 px-3 py-2 sm:block sm:max-w-[240px]">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Automation
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                        {detail.latestAutomationContext.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {sourceLabel(detail.latestAutomationContext.kind)}
                      </p>
                    </div>
                  )}
                </div>

                {/* tags row */}
                {detail.contact.tags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {detail.contact.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/70"
                      >
                        <Tag className="size-2.5" />
                        {tag.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── messages + sidebar grid ── */}
              <div className="flex min-h-0 flex-1">
                {/* messages thread */}
                <div
                  ref={messagesViewportRef}
                  onScroll={(e) => {
                    shouldStickToBottomRef.current = isScrolledNearBottom(
                      e.currentTarget,
                    );
                  }}
                  className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-4"
                >
                  <div className="mx-auto max-w-2xl space-y-3">
                    {detail.messages.map((message) => {
                      const isOutbound = message.direction === "outbound";
                      const richContent = message.richContent;

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-2.5",
                            isOutbound ? "justify-end" : "justify-start",
                          )}
                        >
                          {!isOutbound && (
                            <ContactAvatar
                              displayName={detail.contact.displayName}
                              username={detail.contact.username}
                              profilePictureUrl={
                                detail.contact.profilePictureUrl
                              }
                              size="sm"
                              className="mt-1 shrink-0"
                            />
                          )}

                          <div
                            className={cn(
                              "max-w-[75%]",
                              isOutbound && "flex flex-col items-end",
                            )}
                          >
                            {/* rich content bubble (buttons / quick replies) */}
                            {richContent && richContent.actions.length > 0 ? (
                              <div
                                className={cn(
                                  "min-w-[240px] overflow-hidden rounded-2xl border sm:min-w-[320px]",
                                  isOutbound
                                    ? "border-primary/20 bg-primary/[0.04]"
                                    : "border-border bg-card",
                                )}
                              >
                                <div className="px-3.5 py-3">
                                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground">
                                    {richContent.bodyText}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "border-t",
                                    isOutbound
                                      ? "border-primary/10"
                                      : "border-border",
                                  )}
                                >
                                  {richContent.kind === "quick_reply" ? (
                                    <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
                                      {richContent.actions.map((action) => (
                                        <span
                                          key={`${message.id}-${action.label}`}
                                          className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:bg-muted"
                                        >
                                          {action.label}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    richContent.actions.map((action, idx) =>
                                      action.kind === "web_url" &&
                                      action.url ? (
                                        <a
                                          key={`${message.id}-${action.label}-${idx}`}
                                          href={action.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={cn(
                                            "flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium text-primary transition hover:bg-muted/30",
                                            idx > 0 && "border-t border-border",
                                          )}
                                        >
                                          {action.label}
                                          <ExternalLink className="size-3" />
                                        </a>
                                      ) : (
                                        <div
                                          key={`${message.id}-${action.label}-${idx}`}
                                          className={cn(
                                            "flex items-center justify-center px-3.5 py-2.5 text-[13px] font-medium text-foreground/70",
                                            idx > 0 && "border-t border-border",
                                          )}
                                        >
                                          {action.label}
                                        </div>
                                      ),
                                    )
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* plain text bubble */
                              <div
                                className={cn(
                                  "rounded-2xl px-3.5 py-2.5",
                                  isOutbound
                                    ? "rounded-br-md bg-primary text-primary-foreground"
                                    : "rounded-bl-md border border-border bg-card text-foreground",
                                )}
                              >
                                <p className="whitespace-pre-line text-[13px] leading-relaxed">
                                  {message.displayText}
                                </p>
                              </div>
                            )}

                            <p
                              className={cn(
                                "mt-1 px-0.5 text-[10px] tabular-nums text-muted-foreground/70",
                                isOutbound && "text-right",
                              )}
                            >
                              {formatDateTime(message.eventTime)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* right sidebar: automation history + sequences */}
                <aside className="hidden w-[260px] shrink-0 border-l border-border bg-card/50 p-4 xl:block">
                  <div className="space-y-5">
                    <InfoBlock icon={Sparkles} title="Automation history">
                      {detail.automationHistory.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No automations triggered.
                        </p>
                      ) : (
                        detail.automationHistory
                          .slice(0, 6)
                          .map((automation) => (
                            <div
                              key={automation.id}
                              className="rounded-lg border border-border bg-background p-2.5"
                            >
                              <p className="text-[13px] font-medium text-foreground">
                                {automation.label}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {sourceLabel(automation.kind)}{" "}
                                <span className="text-muted-foreground/60">
                                  &middot;
                                </span>{" "}
                                {formatRelativeTime(automation.lastMatchedAt)}
                              </p>
                            </div>
                          ))
                      )}
                    </InfoBlock>

                    <InfoBlock icon={TimerReset} title="Sequences">
                      {detail.sequenceEnrollments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No enrollments.
                        </p>
                      ) : (
                        detail.sequenceEnrollments.map((seq) => (
                          <div
                            key={seq.id}
                            className="rounded-lg border border-border bg-background p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[13px] font-medium text-foreground">
                                {seq.name}
                              </p>
                              <StatusPill
                                status={seq.status}
                                className="py-0 text-[10px]"
                              />
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Enrolled {formatRelativeTime(seq.enrolledAt)}
                            </p>
                          </div>
                        ))
                      )}
                    </InfoBlock>
                  </div>
                </aside>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─── sub-components ─── */

function ListState({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-20 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function DetailState({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function DetailPlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="flex max-w-xs flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <MessageSquare className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Select a conversation
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Choose a thread from the list to view messages and automation
            context.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
