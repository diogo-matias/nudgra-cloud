"use client";

import Link from "next/link";
import { Plus, Zap, MoreHorizontal, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Shell mock data — replace with Convex query in the next pass
const MOCK_RULES = [
  {
    id: "1",
    name: "Link in bio",
    keywords: ["link", "website", "url"],
    reply: "Here's our link! Check it out at the link in our bio.",
    triggerType: "keyword" as const,
    active: true,
    triggerCount: 47,
    createdAt: "Mar 10",
  },
  {
    id: "2",
    name: "Pricing inquiry",
    keywords: ["price", "pricing", "cost", "how much"],
    reply: "Thanks for asking! DM me 'info' to get our full pricing breakdown.",
    triggerType: "keyword" as const,
    active: true,
    triggerCount: 23,
    createdAt: "Mar 12",
  },
  {
    id: "3",
    name: "Collaboration request",
    keywords: ["collab", "collaborate", "partnership"],
    reply: "Thanks for reaching out! Please fill out our collab form — link in bio.",
    triggerType: "keyword" as const,
    active: false,
    triggerCount: 5,
    createdAt: "Mar 20",
  },
];

export default function RulesPage() {
  const activeCount = MOCK_RULES.filter((r) => r.active).length;

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Automation Rules
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount} of {MOCK_RULES.length} rules active
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

        {/* Rules list */}
        {MOCK_RULES.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {MOCK_RULES.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function RuleCard({
  rule,
}: {
  rule: (typeof MOCK_RULES)[number];
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      {/* Icon */}
      <div
        className={cn(
          "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          rule.active ? "bg-primary/10" : "bg-muted"
        )}
      >
        <Zap
          className={cn(
            "size-4",
            rule.active ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">{rule.name}</p>
          <span
            className={cn(
              "inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border",
              rule.active
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : "text-muted-foreground bg-muted border-border"
            )}
          >
            {rule.active ? "Active" : "Paused"}
          </span>
        </div>

        {/* Keywords */}
        <div className="flex flex-wrap gap-1.5">
          {rule.keywords.map((kw) => (
            <span
              key={kw}
              className="text-xs font-mono text-muted-foreground bg-muted border border-border rounded-md px-1.5 py-0.5"
            >
              {kw}
            </span>
          ))}
        </div>

        {/* Reply preview */}
        <p className="text-xs text-muted-foreground truncate max-w-md">
          Reply: "{rule.reply}"
        </p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {rule.triggerCount}
          </p>
          <p className="text-xs text-muted-foreground">triggers</p>
        </div>

        <button
          title={rule.active ? "Pause rule" : "Activate rule"}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {rule.active ? (
            <ToggleRight className="size-5 text-primary" />
          ) : (
            <ToggleLeft className="size-5" />
          )}
        </button>

        <Link
          href={`/dashboard/rules/${rule.id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <MoreHorizontal className="size-4" />
        </Link>
      </div>
    </div>
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
