"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ToggleLeft, ToggleRight, Tag } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function RuleDetailPage() {
  const params = useParams<{ ruleId: string }>();
  const rule = useQuery(api.automations.rules.getRuleById, {
    ruleId: params.ruleId as Id<"automationRules">,
  });
  const toggleRule = useMutation(api.automations.rules.toggleRule);

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-2xl w-full flex flex-col gap-6">
        <Link
          href="/dashboard/automations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="size-3.5" />
          Back to automations
        </Link>

        {rule === undefined ? (
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Loading rule...
          </div>
        ) : rule === null ? (
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Rule not found.
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl p-5 flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {rule.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Trigger: {rule.triggerType.replace("_", " ")} · Match:{" "}
                  {rule.matchType}
                </p>
                <p className="text-sm text-muted-foreground">
                  Triggered {rule.triggerCount} time
                  {rule.triggerCount === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void toggleRule({
                    ruleId: rule.id,
                    isActive: !rule.isActive,
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                {rule.isActive ? (
                  <ToggleRight className="size-5 text-primary" />
                ) : (
                  <ToggleLeft className="size-5" />
                )}
                {rule.isActive ? "Pause" : "Activate"}
              </button>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Keywords
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {rule.keywords.length > 0 ? (
                    rule.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-mono text-muted-foreground"
                      >
                        {keyword}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      This rule listens for story replies.
                    </span>
                  )}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Reply
                </p>
                <p className="text-sm text-foreground mt-2 leading-relaxed">
                  {rule.replyText}
                </p>
              </section>

              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tags
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {rule.tags.length > 0 ? (
                    rule.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
                      >
                        <Tag className="size-3" />
                        {tag.label}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No tags applied by this rule.
                    </span>
                  )}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Sequence
                </p>
                <p className="text-sm text-foreground mt-2">
                  {rule.sequence ? rule.sequence.name : "No follow-up sequence"}
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
