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
import {
  formatCommentAutomationTimestamp,
  getCommentAutomationLatestSessionSummary,
} from "@/lib/comment-automation-ui";

export default function AutomationsPage() {
  const [showTypeModal, setShowTypeModal] = useState(false);

  // Old keyword/DM rules
  const rules = useQuery(api.automations.rules.listCurrentRules) ?? [];
  const toggleRule = useMutation(api.automations.rules.toggleRule);

  // New comment automations
  const commentAutomations =
    useQuery(api.automations.commentAutomations.listCommentAutomations) ?? [];
  const toggleCommentAutomation = useMutation(
    api.automations.commentAutomations.toggleCommentAutomation,
  );

  const activeRulesCount = rules.filter((r) => r.isActive).length;
  const liveCommentCount = commentAutomations.filter(
    (a) => a.status === "live",
  ).length;
  const totalActive = activeRulesCount + liveCommentCount;
  const totalCount = rules.length + commentAutomations.length;

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Automations
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalActive} of {totalCount} automations active
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
          <div className="flex flex-col gap-3">
            {/* Comment automations */}
            {commentAutomations.map((automation) => (
              <Link
                key={automation.id}
                href={`/dashboard/automations/comments/${automation.id}`}
                className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 hover:shadow-sm transition-all"
              >
                <div
                  className={cn(
                    "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
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

                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">
                      {automation.name}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border",
                        automation.status === "live"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : automation.status === "paused"
                            ? "text-muted-foreground bg-muted border-border"
                            : "text-amber-700 bg-amber-50 border-amber-200",
                      )}
                    >
                      {automation.status === "live"
                        ? "Live"
                        : automation.status === "paused"
                          ? "Paused"
                          : "Draft"}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                      Comment DM
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

                  <div className="flex flex-wrap gap-1.5">
                    {automation.triggerKeywordLabels.length > 0 ? (
                      automation.triggerKeywordLabels.slice(0, 5).map((keyword) => (
                        <span
                          key={keyword}
                          className="text-xs font-mono text-muted-foreground bg-muted border border-border rounded-md px-1.5 py-0.5"
                        >
                          {keyword}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Trigger: any comment
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground max-w-xl truncate">
                    {automation.postScope === "specific"
                      ? `${automation.selectedMediaIds.length} post${automation.selectedMediaIds.length !== 1 ? "s" : ""}`
                      : automation.postScope === "any"
                        ? "Any post or reel"
                        : automation.nextLockedMediaId
                          ? `Locked next post - ${formatCommentAutomationTimestamp(automation.nextLockedAt)}`
                          : automation.status === "live"
                            ? "Waiting for the next published post"
                            : "Next post or reel"}
                    {automation.linkUrl ? ` · Link: ${automation.linkUrl}` : ""}
                  </p>
                  {automation.latestSession ? (
                    <p className="text-xs text-muted-foreground max-w-xl truncate">
                      {getCommentAutomationLatestSessionSummary(
                        automation.latestSession,
                      )}
                    </p>
                  ) : null}
                  {automation.validationIssues.length > 0 ? (
                    <p className="text-xs text-amber-800">
                      {automation.validationIssues[0]}
                    </p>
                  ) : null}
                  {automation.guardrailReason ? (
                    <p className="text-xs text-destructive">
                      {automation.guardrailReason}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {automation.triggerCount}
                    </p>
                    <p className="text-xs text-muted-foreground">triggers</p>
                  </div>

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
            ))}

            {/* Old keyword/DM rules */}
            {rules.map((rule) => (
              <Link
                key={rule.id}
                href={`/dashboard/automations/rules/${rule.id}`}
                className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 hover:shadow-sm transition-all"
              >
                <div
                  className={cn(
                    "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
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

                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">
                      {rule.name}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border",
                        rule.isActive
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : "text-muted-foreground bg-muted border-border",
                      )}
                    >
                      {rule.isActive ? "Active" : "Paused"}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                      DM Rule
                    </span>
                    {rule.sequence ? (
                      <span className="text-xs text-muted-foreground">
                        Sequence: {rule.sequence.name}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {rule.keywords.length > 0 ? (
                      rule.keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="text-xs font-mono text-muted-foreground bg-muted border border-border rounded-md px-1.5 py-0.5"
                        >
                          {keyword}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Trigger: {rule.triggerType.replace("_", " ")}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground max-w-xl truncate">
                    Reply: &quot;{rule.replyText}&quot;
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {rule.triggerCount}
                    </p>
                    <p className="text-xs text-muted-foreground">triggers</p>
                  </div>

                  <button
                    type="button"
                    title={rule.isActive ? "Pause rule" : "Activate rule"}
                    onClick={(event) => {
                      event.preventDefault();
                      void toggleRule({
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
