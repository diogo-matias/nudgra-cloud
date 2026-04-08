"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Plus, Zap, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

export default function RulesPage() {
  const rules = useQuery(api.automations.rules.listCurrentRules) ?? [];
  const toggleRule = useMutation(api.automations.rules.toggleRule);
  const activeCount = rules.filter((rule) => rule.isActive).length;

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Automation Rules
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount} of {rules.length} rules active
            </p>
          </div>
          <Link
            href="/dashboard/rules/new"
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
          >
            <Plus className="size-4" />
            New rule
          </Link>
        </div>

        {rules.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {rules.map((rule) => (
              <Link
                key={rule.id}
                href={`/dashboard/rules/${rule.id}`}
                className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 hover:shadow-sm transition-all"
              >
                <div
                  className={cn(
                    "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    rule.isActive ? "bg-primary/10" : "bg-muted"
                  )}
                >
                  <Zap
                    className={cn(
                      "size-4",
                      rule.isActive ? "text-primary" : "text-muted-foreground"
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
                          : "text-muted-foreground bg-muted border-border"
                      )}
                    >
                      {rule.isActive ? "Active" : "Paused"}
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
    </main>
  );
}

function EmptyState() {
  return (
    <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center text-center gap-3">
      <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
        <Zap className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">No rules yet</p>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Create your first rule to start replying to DMs automatically when
          someone sends a keyword.
        </p>
      </div>
      <Link
        href="/dashboard/rules/new"
        className="mt-1 inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus className="size-4" />
        Create rule
      </Link>
    </div>
  );
}
