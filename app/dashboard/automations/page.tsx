"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BookOpen,
  MessageSquare,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Zap,
} from "lucide-react";
import { AutomationDeleteDialog } from "@/components/dashboard/automation-delete-dialog";
import { AutomationTypeModal } from "@/components/dashboard/automation-type-modal";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatRelativeTime } from "@/lib/comment-automation-ui";
import { cn } from "@/lib/utils";

type DeleteTarget =
  | {
      kind: "comment";
      id: Id<"commentAutomations">;
      name: string;
    }
  | {
      kind: "story";
      id: Id<"storyAutomations">;
      name: string;
    }
  | {
      kind: "rule";
      id: Id<"automationRules">;
      name: string;
    };

const rowClassName =
  "grid grid-cols-[1fr_auto] items-center px-5 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[1fr_80px_72px_100px_92px]";
const iconButtonClassName =
  "rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

function preventRowNavigation(event: {
  preventDefault: () => void;
  stopPropagation: () => void;
}) {
  event.preventDefault();
  event.stopPropagation();
}

export default function AutomationsPage() {
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;

  const rules =
    useQuery(
      api.automations.rules.listCurrentRules,
      selectedAccount ? { accountId: selectedAccount.id } : "skip",
    ) ?? [];
  const toggleRule = useMutation(api.automations.rules.toggleRule);
  const deleteRule = useMutation(api.automations.rules.deleteRule);

  const commentAutomations =
    useQuery(
      api.automations.commentAutomations.listCommentAutomations,
      selectedAccount ? { accountId: selectedAccount.id } : "skip",
    ) ?? [];
  const toggleCommentAutomation = useMutation(
    api.automations.commentAutomations.toggleCommentAutomation,
  );
  const deleteCommentAutomation = useMutation(
    api.automations.commentAutomations.deleteCommentAutomation,
  );

  const storyAutomations =
    useQuery(
      api.automations.storyAutomations.listStoryAutomations,
      selectedAccount ? { accountId: selectedAccount.id } : "skip",
    ) ?? [];
  const toggleStoryAutomation = useMutation(
    api.automations.storyAutomations.toggleStoryAutomation,
  );
  const deleteStoryAutomation = useMutation(
    api.automations.storyAutomations.deleteStoryAutomation,
  );

  const activeRulesCount = rules.filter((rule) => rule.isActive).length;
  const liveCommentCount = commentAutomations.filter(
    (automation) => automation.status === "live",
  ).length;
  const liveStoryCount = storyAutomations.filter(
    (automation) => automation.status === "live",
  ).length;
  const totalActive = activeRulesCount + liveCommentCount + liveStoryCount;
  const totalCount = rules.length + commentAutomations.length + storyAutomations.length;

  function handleDeleteDialogChange(open: boolean) {
    if (isDeleting) {
      return;
    }

    if (!open) {
      setDeleteTarget(null);
      setDeleteError(null);
    }
  }

  async function handleConfirmDelete() {
    if (!selectedAccount || deleteTarget === null || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      if (deleteTarget.kind === "comment") {
        await deleteCommentAutomation({
          accountId: selectedAccount.id,
          automationId: deleteTarget.id,
        });
      } else if (deleteTarget.kind === "story") {
        await deleteStoryAutomation({
          accountId: selectedAccount.id,
          automationId: deleteTarget.id,
        });
      } else {
        await deleteRule({
          accountId: selectedAccount.id,
          ruleId: deleteTarget.id,
        });
      }

      setDeleteTarget(null);
      setDeleteError(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete automation.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  if (selectedAccount === null) {
    return (
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active account from the sidebar or connect a new one before managing automations."
        />
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Automations
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {totalActive} of {totalCount} automations active for{" "}
              {selectedAccount.username
                ? `@${selectedAccount.username}`
                : "the active account"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTypeModal(true)}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            New automation
          </button>
        </div>

        {totalCount === 0 ? (
          <EmptyState onNew={() => setShowTypeModal(true)} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid grid-cols-[1fr_auto] items-center border-b border-border bg-muted/50 px-5 py-3 sm:grid-cols-[1fr_80px_72px_100px_92px]">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Name
              </span>
              <span className="hidden text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:block">
                Runs
              </span>
              <span className="hidden text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:block">
                CTR
              </span>
              <span className="hidden text-right text-xs font-medium uppercase tracking-wider text-muted-foreground sm:block">
                Modified
              </span>
              <span className="sr-only">Actions</span>
            </div>

            {commentAutomations.map((automation, index) => {
              const ctr =
                automation.totalSessions > 0
                  ? (
                      (automation.buttonClickCount / automation.totalSessions) *
                      100
                    ).toFixed(1)
                  : null;

              return (
                <Link
                  key={automation.id}
                  href={`/dashboard/automations/comments/${automation.id}`}
                  className={cn(
                    rowClassName,
                    index <
                      commentAutomations.length + storyAutomations.length + rules.length - 1 &&
                      "border-b border-border",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        automation.status === "live" ? "bg-primary/10" : "bg-muted",
                      )}
                    >
                      <MessageSquare
                        className={cn(
                          "size-4",
                          automation.status === "live"
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            automation.status === "live"
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : automation.status === "paused"
                                ? "border border-border bg-muted text-muted-foreground"
                                : "border border-amber-200 bg-amber-50 text-amber-700",
                          )}
                        >
                          {automation.status === "live"
                            ? "Live"
                            : automation.status === "paused"
                              ? "Paused"
                              : "Draft"}
                        </span>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {automation.name}
                        </p>
                        {automation.validationIssues.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            <AlertTriangle className="size-3" />
                            Needs fix
                          </span>
                        ) : null}
                        {automation.guardrailTrippedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/5 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            <AlertTriangle className="size-3" />
                            Safety paused
                          </span>
                        ) : null}
                      </div>
                      <p className="max-w-md truncate text-xs text-muted-foreground">
                        {automation.commentFilter === "any_word"
                          ? "User comments on any post"
                          : `User comments on ${
                              automation.postScope === "specific"
                                ? `${automation.selectedMediaIds.length} post${automation.selectedMediaIds.length !== 1 ? "s" : ""}`
                                : automation.postScope === "any"
                                  ? "any post or reel"
                                  : "next post"
                            } and comment contains ${
                              automation.triggerKeywordLabels.length > 0
                                ? automation.triggerKeywordLabels
                                    .slice(0, 3)
                                    .map((keyword) => `"${keyword}"`)
                                    .join(", ") +
                                  (automation.triggerKeywordLabels.length > 3
                                    ? ` +${automation.triggerKeywordLabels.length - 3}`
                                    : "")
                                : "any word"
                            }`}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground sm:hidden">
                        <span className="tabular-nums font-medium text-foreground">
                          {automation.triggerCount}
                        </span>
                        <span>runs</span>
                        {ctr !== null ? (
                          <>
                            <span className="text-border">|</span>
                            <span className="tabular-nums font-medium text-foreground">
                              {ctr}%
                            </span>
                            <span>CTR</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <p className="hidden text-right text-sm font-semibold tabular-nums text-foreground sm:block">
                    {automation.triggerCount}
                  </p>
                  <p className="hidden text-right text-sm font-semibold tabular-nums text-foreground sm:block">
                    {ctr !== null ? `${ctr}%` : "\u2014"}
                  </p>
                  <p className="hidden text-right text-xs text-muted-foreground sm:block">
                    {formatRelativeTime(automation.lastModifiedAt)}
                  </p>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      disabled={
                        automation.status !== "live" &&
                        automation.validationIssues.length > 0
                      }
                      title={
                        automation.status !== "live" &&
                        automation.validationIssues.length > 0
                          ? automation.validationIssues[0] ??
                            "Automation must be fixed before going live."
                          : automation.status === "live"
                            ? "Pause automation"
                            : "Go live"
                      }
                      onClick={(event) => {
                        preventRowNavigation(event);
                        void toggleCommentAutomation({
                          accountId: selectedAccount.id,
                          automationId: automation.id,
                          status: automation.status === "live" ? "paused" : "live",
                        });
                      }}
                      className={iconButtonClassName}
                    >
                      {automation.status === "live" ? (
                        <ToggleRight className="size-5 text-primary" />
                      ) : (
                        <ToggleLeft className="size-5" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Delete automation"
                      onClick={(event) => {
                        preventRowNavigation(event);
                        setDeleteError(null);
                        setDeleteTarget({
                          kind: "comment",
                          id: automation.id,
                          name: automation.name,
                        });
                      }}
                      className={iconButtonClassName}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </Link>
              );
            })}

            {storyAutomations.map((automation, index) => {
              const ctr =
                automation.totalSessions > 0
                  ? (
                      (automation.buttonClickCount / automation.totalSessions) *
                      100
                    ).toFixed(1)
                  : null;

              return (
                <Link
                  key={automation.id}
                  href={`/dashboard/automations/stories/${automation.id}`}
                  className={cn(
                    rowClassName,
                    index < storyAutomations.length + rules.length - 1 &&
                      "border-b border-border",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        automation.status === "live" ? "bg-primary/10" : "bg-muted",
                      )}
                    >
                      <BookOpen
                        className={cn(
                          "size-4",
                          automation.status === "live"
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            automation.status === "live"
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : automation.status === "paused"
                                ? "border border-border bg-muted text-muted-foreground"
                                : "border border-amber-200 bg-amber-50 text-amber-700",
                          )}
                        >
                          {automation.status === "live"
                            ? "Live"
                            : automation.status === "paused"
                              ? "Paused"
                              : "Draft"}
                        </span>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {automation.name}
                        </p>
                        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Story automation
                        </span>
                        {automation.validationIssues.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            <AlertTriangle className="size-3" />
                            Needs fix
                          </span>
                        ) : null}
                        {automation.guardrailTrippedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/5 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            <AlertTriangle className="size-3" />
                            Safety paused
                          </span>
                        ) : null}
                      </div>
                      <p className="max-w-md truncate text-xs text-muted-foreground">
                        {automation.storyScope === "specific"
                          ? "Replies to one specific story"
                          : "Replies to any story"}
                        {" \u00B7 "}
                        {automation.replyFilter === "any_word_or_reaction"
                          ? "Matches any word or reaction"
                          : `Matches ${
                              automation.triggerTokenLabels.length > 0
                                ? automation.triggerTokenLabels
                                    .slice(0, 3)
                                    .map((token) => `"${token}"`)
                                    .join(", ") +
                                  (automation.triggerTokenLabels.length > 3
                                    ? ` +${automation.triggerTokenLabels.length - 3}`
                                    : "")
                                : "specific words or reactions"
                            }`}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground sm:hidden">
                        <span className="tabular-nums font-medium text-foreground">
                          {automation.triggerCount}
                        </span>
                        <span>runs</span>
                        {ctr !== null ? (
                          <>
                            <span className="text-border">|</span>
                            <span className="tabular-nums font-medium text-foreground">
                              {ctr}%
                            </span>
                            <span>CTR</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <p className="hidden text-right text-sm font-semibold tabular-nums text-foreground sm:block">
                    {automation.triggerCount}
                  </p>
                  <p className="hidden text-right text-sm font-semibold tabular-nums text-foreground sm:block">
                    {ctr !== null ? `${ctr}%` : "\u2014"}
                  </p>
                  <p className="hidden text-right text-xs text-muted-foreground sm:block">
                    {formatRelativeTime(automation.lastModifiedAt)}
                  </p>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      disabled={
                        automation.status !== "live" &&
                        automation.validationIssues.length > 0
                      }
                      title={
                        automation.status !== "live" &&
                        automation.validationIssues.length > 0
                          ? automation.validationIssues[0] ??
                            "Automation must be fixed before going live."
                          : automation.status === "live"
                            ? "Pause automation"
                            : "Go live"
                      }
                      onClick={(event) => {
                        preventRowNavigation(event);
                        void toggleStoryAutomation({
                          accountId: selectedAccount.id,
                          automationId: automation.id,
                          status: automation.status === "live" ? "paused" : "live",
                        });
                      }}
                      className={iconButtonClassName}
                    >
                      {automation.status === "live" ? (
                        <ToggleRight className="size-5 text-primary" />
                      ) : (
                        <ToggleLeft className="size-5" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Delete automation"
                      onClick={(event) => {
                        preventRowNavigation(event);
                        setDeleteError(null);
                        setDeleteTarget({
                          kind: "story",
                          id: automation.id,
                          name: automation.name,
                        });
                      }}
                      className={iconButtonClassName}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </Link>
              );
            })}

            {rules.map((rule, index) => (
              <Link
                key={rule.id}
                href={`/dashboard/automations/rules/${rule.id}`}
                className={cn(
                  rowClassName,
                  index < rules.length - 1 && "border-b border-border",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                      rule.isActive ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    <Zap
                      className={cn(
                        "size-4",
                        rule.isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          rule.isActive
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {rule.isActive ? "Active" : "Paused"}
                      </span>
                      <p className="truncate text-sm font-semibold text-foreground">
                        {rule.name}
                      </p>
                      <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {rule.triggerType === "story_reply"
                          ? "Legacy story rule"
                          : "DM automation"}
                      </span>
                    </div>
                    <p className="max-w-md truncate text-xs text-muted-foreground">
                      {rule.triggerType === "story_reply"
                        ? "Legacy story-reply automation rule"
                        : rule.keywords.length > 0
                          ? `Keyword trigger: ${rule.keywords
                              .slice(0, 3)
                              .map((keyword) => `"${keyword}"`)
                              .join(", ")}${rule.keywords.length > 3 ? ` +${rule.keywords.length - 3}` : ""}`
                          : `Trigger: ${rule.triggerType.replace("_", " ")}`}
                      {" \u00B7 "}DM: &quot;
                      {(
                        rule.linkDmText.length > 50
                          ? `${rule.linkDmText.slice(0, 50)}...`
                          : rule.linkDmText
                      ) || "No message"}
                      &quot;
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground sm:hidden">
                      <span className="tabular-nums font-medium text-foreground">
                        {rule.triggerCount}
                      </span>
                      <span>runs</span>
                    </div>
                  </div>
                </div>

                <p className="hidden text-right text-sm font-semibold tabular-nums text-foreground sm:block">
                  {rule.triggerCount}
                </p>
                <p className="hidden text-right text-sm text-muted-foreground sm:block">
                  {"\u2014"}
                </p>
                <p className="hidden text-right text-xs text-muted-foreground sm:block">
                  {formatRelativeTime(rule.lastModifiedAt)}
                </p>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    title={rule.isActive ? "Pause rule" : "Activate rule"}
                    onClick={(event) => {
                      preventRowNavigation(event);
                      void toggleRule({
                        accountId: selectedAccount.id,
                        ruleId: rule.id,
                        isActive: !rule.isActive,
                      });
                    }}
                    className={iconButtonClassName}
                  >
                    {rule.isActive ? (
                      <ToggleRight className="size-5 text-primary" />
                    ) : (
                      <ToggleLeft className="size-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Delete automation"
                    onClick={(event) => {
                      preventRowNavigation(event);
                      setDeleteError(null);
                      setDeleteTarget({
                        kind: "rule",
                        id: rule.id,
                        name: rule.name,
                      });
                    }}
                    className={iconButtonClassName}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <AutomationDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={handleDeleteDialogChange}
        automationKind={deleteTarget?.kind ?? "comment"}
        automationName={deleteTarget?.name ?? ""}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={() => void handleConfirmDelete()}
      />

      <AutomationTypeModal
        open={showTypeModal}
        onOpenChange={setShowTypeModal}
      />
    </main>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
        <Zap className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          No automations yet
        </p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Create your first automation to start engaging with your audience
          automatically.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="size-4" />
        Create automation
      </button>
    </div>
  );
}
