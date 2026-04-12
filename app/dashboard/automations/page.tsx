"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Plus,
  Zap,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { AutomationTypeModal } from "@/components/dashboard/automation-type-modal";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";
import { formatRelativeTime } from "@/lib/comment-automation-ui";

export default function AutomationsPage() {
  const [showTypeModal, setShowTypeModal] = useState(false);
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;

  // Keyword DM rules
  const rules =
    useQuery(
      api.automations.rules.listCurrentRules,
      selectedAccount ? { accountId: selectedAccount.id } : "skip",
    ) ?? [];
  const toggleRule = useMutation(api.automations.rules.toggleRule);

  // New comment automations
  const commentAutomations =
    useQuery(
      api.automations.commentAutomations.listCommentAutomations,
      selectedAccount ? { accountId: selectedAccount.id } : "skip",
    ) ?? [];
  const toggleCommentAutomation = useMutation(
    api.automations.commentAutomations.toggleCommentAutomation,
  );

  const activeRulesCount = rules.filter((r) => r.isActive).length;
  const liveCommentCount = commentAutomations.filter(
    (a) => a.status === "live",
  ).length;
  const totalActive = activeRulesCount + liveCommentCount;
  const totalCount = rules.length + commentAutomations.length;

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
      <div className="max-w-5xl w-full flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Automations
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalActive} of {totalCount} automations active for{" "}
              {selectedAccount.username
                ? `@${selectedAccount.username}`
                : "the active account"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTypeModal(true)}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
          >
            <Plus className="size-4" />
            New automation
          </button>
        </div>

        {/* Empty state */}
        {totalCount === 0 ? (
          <EmptyState onNew={() => setShowTypeModal(true)} />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_72px_100px_44px] items-center px-5 py-3 border-b border-border bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right hidden sm:block">
                Runs
              </span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right hidden sm:block">
                CTR
              </span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right hidden sm:block">
                Modified
              </span>
              <span className="sr-only">Actions</span>
            </div>

            {/* Comment automations */}
            {commentAutomations.map((automation, index) => {
              const ctr =
                automation.totalSessions > 0
                  ? (
                      (automation.buttonClickCount /
                        automation.totalSessions) *
                      100
                    ).toFixed(1)
                  : null;

              return (
                <Link
                  key={automation.id}
                  href={`/dashboard/automations/comments/${automation.id}`}
                  className={cn(
                    "grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_72px_100px_44px] items-center px-5 py-4 hover:bg-muted/30 transition-colors",
                    index < commentAutomations.length + rules.length - 1 &&
                      "border-b border-border",
                  )}
                >
                  {/* Name + info column */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        automation.status === "live"
                          ? "bg-primary/10"
                          : "bg-muted",
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
                    <div className="min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5",
                            automation.status === "live"
                              ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                              : automation.status === "paused"
                                ? "text-muted-foreground bg-muted border border-border"
                                : "text-amber-700 bg-amber-50 border border-amber-200",
                          )}
                        >
                          {automation.status === "live"
                            ? "Live"
                            : automation.status === "paused"
                              ? "Paused"
                              : "Draft"}
                        </span>
                        <p className="text-sm font-semibold text-foreground truncate">
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
                      <p className="text-xs text-muted-foreground truncate max-w-md">
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
                                    .map((k) => `"${k}"`)
                                    .join(", ") +
                                  (automation.triggerKeywordLabels.length > 3
                                    ? ` +${automation.triggerKeywordLabels.length - 3}`
                                    : "")
                                : "any word"
                            }`}
                      </p>
                      {/* Mobile stats row */}
                      <div className="flex items-center gap-3 sm:hidden text-xs text-muted-foreground mt-0.5">
                        <span className="tabular-nums font-medium text-foreground">
                          {automation.triggerCount}
                        </span>
                        <span>runs</span>
                        {ctr !== null && (
                          <>
                            <span className="text-border">|</span>
                            <span className="tabular-nums font-medium text-foreground">
                              {ctr}%
                            </span>
                            <span>CTR</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Runs */}
                  <p className="text-sm font-semibold text-foreground tabular-nums text-right hidden sm:block">
                    {automation.triggerCount}
                  </p>

                  {/* CTR */}
                  <p className="text-sm font-semibold text-foreground tabular-nums text-right hidden sm:block">
                    {ctr !== null ? `${ctr}%` : "\u2014"}
                  </p>

                  {/* Modified */}
                  <p className="text-xs text-muted-foreground text-right hidden sm:block">
                    {formatRelativeTime(automation.lastModifiedAt)}
                  </p>

                  {/* Toggle */}
                  <div className="flex justify-end">
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
                        event.preventDefault();
                        void toggleCommentAutomation({
                          accountId: selectedAccount.id,
                          automationId: automation.id,
                          status:
                            automation.status === "live" ? "paused" : "live",
                        });
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      {automation.status === "live" ? (
                        <ToggleRight className="size-5 text-primary" />
                      ) : (
                        <ToggleLeft className="size-5" />
                      )}
                    </button>
                  </div>
                </Link>
              );
            })}

            {/* Keyword DM rules */}
            {rules.map((rule, index) => (
              <Link
                key={rule.id}
                href={`/dashboard/automations/rules/${rule.id}`}
                className={cn(
                  "grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_72px_100px_44px] items-center px-5 py-4 hover:bg-muted/30 transition-colors",
                  index < rules.length - 1 && "border-b border-border",
                )}
              >
                {/* Name + info column */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={cn(
                      "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      rule.isActive ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    <Zap
                      className={cn(
                        "size-4",
                        rule.isActive
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5",
                          rule.isActive
                            ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                            : "text-muted-foreground bg-muted border border-border",
                        )}
                      >
                        {rule.isActive ? "Active" : "Paused"}
                      </span>
                      <p className="text-sm font-semibold text-foreground truncate">
                        {rule.name}
                      </p>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                        DM automation
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-md">
                      {rule.keywords.length > 0
                        ? `Keyword trigger: ${rule.keywords.slice(0, 3).map((k) => `"${k}"`).join(", ")}${rule.keywords.length > 3 ? ` +${rule.keywords.length - 3}` : ""}`
                        : `Trigger: ${rule.triggerType.replace("_", " ")}`}
                      {" \u00B7 "}DM: &quot;
                      {(
                        rule.linkDmText.length > 50
                          ? rule.linkDmText.slice(0, 50) + "..."
                          : rule.linkDmText
                      ) || "No message"}
                      &quot;
                    </p>
                    {/* Mobile stats */}
                    <div className="flex items-center gap-3 sm:hidden text-xs text-muted-foreground mt-0.5">
                      <span className="tabular-nums font-medium text-foreground">
                        {rule.triggerCount}
                      </span>
                      <span>runs</span>
                    </div>
                  </div>
                </div>

                {/* Runs */}
                <p className="text-sm font-semibold text-foreground tabular-nums text-right hidden sm:block">
                  {rule.triggerCount}
                </p>

                {/* CTR — not tracked for DM rules */}
                <p className="text-sm text-muted-foreground text-right hidden sm:block">
                  {"\u2014"}
                </p>

                {/* Modified */}
                <p className="text-xs text-muted-foreground text-right hidden sm:block">
                  {formatRelativeTime(rule.lastModifiedAt)}
                </p>

                {/* Toggle */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    title={rule.isActive ? "Pause rule" : "Activate rule"}
                    onClick={(event) => {
                      event.preventDefault();
                      void toggleRule({
                        accountId: selectedAccount.id,
                        ruleId: rule.id,
                        isActive: !rule.isActive,
                      });
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {rule.isActive ? (
                      <ToggleRight className="size-5 text-primary" />
                    ) : (
                      <ToggleLeft className="size-5" />
                    )}
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <AutomationTypeModal
        open={showTypeModal}
        onOpenChange={setShowTypeModal}
      />
    </main>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center text-center gap-3">
      <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
        <Zap className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          No automations yet
        </p>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Create your first automation to start engaging with your audience
          automatically.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="mt-1 inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
      >
        <Plus className="size-4" />
        Create automation
      </button>
    </div>
  );
}
