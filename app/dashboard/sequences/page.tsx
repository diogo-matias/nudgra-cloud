"use client";

import { useState } from "react";
import Link from "next/link";
import { GitBranch, Plus, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Shell mock data — replace with Convex queries in the next pass
const MOCK_SEQUENCES = [
  {
    id: "1",
    name: "Post-purchase follow-up",
    stepCount: 3,
    triggerRule: "Pricing inquiry",
    active: true,
    enrollments: 12,
    createdAt: "Mar 15",
  },
  {
    id: "2",
    name: "Welcome sequence",
    stepCount: 2,
    triggerRule: "Link in bio",
    active: true,
    enrollments: 31,
    createdAt: "Mar 18",
  },
  {
    id: "3",
    name: "Re-engagement",
    stepCount: 4,
    triggerRule: "Story reply",
    active: false,
    enrollments: 0,
    createdAt: "Apr 1",
  },
];

const MOCK_ENROLLMENTS = [
  {
    id: "1",
    contact: { username: "sarah_creates", displayName: "Sarah M." },
    sequence: "Post-purchase follow-up",
    currentStep: 2,
    totalSteps: 3,
    startedAt: "Apr 5",
    nextStepAt: "Apr 8, 10:00",
    status: "active" as const,
  },
  {
    id: "2",
    contact: { username: "luna_vibes", displayName: "Luna K." },
    sequence: "Welcome sequence",
    currentStep: 1,
    totalSteps: 2,
    startedAt: "Apr 7",
    nextStepAt: "Apr 8, 14:30",
    status: "active" as const,
  },
  {
    id: "3",
    contact: { username: "the_real_marco", displayName: "Marco V." },
    sequence: "Welcome sequence",
    currentStep: 2,
    totalSteps: 2,
    startedAt: "Apr 2",
    nextStepAt: "—",
    status: "complete" as const,
  },
];

type Tab = "definitions" | "enrollments";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function SequencesPage() {
  const [tab, setTab] = useState<Tab>("definitions");

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Sequences</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Multi-step follow-up flows that run after a rule triggers.
            </p>
          </div>
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity opacity-60 cursor-not-allowed shrink-0"
          >
            <Plus className="size-4" />
            New sequence
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 bg-muted rounded-lg p-1 w-fit">
          {(["definitions", "enrollments"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer capitalize",
                tab === t
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "definitions" ? "Sequences" : "Active enrollments"}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "definitions" ? (
          <DefinitionsTab />
        ) : (
          <EnrollmentsTab />
        )}
      </div>
    </main>
  );
}

function DefinitionsTab() {
  return (
    <div className="flex flex-col gap-3">
      {MOCK_SEQUENCES.length === 0 ? (
        <EmptyState
          label="No sequences yet"
          description="Create a sequence to send delayed follow-up messages after a rule triggers."
        />
      ) : (
        MOCK_SEQUENCES.map((seq) => (
          <div
            key={seq.id}
            className="bg-card border border-border rounded-xl p-5 flex items-center gap-4"
          >
            <div
              className={cn(
                "size-9 rounded-lg flex items-center justify-center shrink-0",
                seq.active ? "bg-primary/10" : "bg-muted"
              )}
            >
              <GitBranch
                className={cn(
                  "size-4",
                  seq.active ? "text-primary" : "text-muted-foreground"
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{seq.name}</p>
                <span
                  className={cn(
                    "text-xs font-medium rounded-full px-2 py-0.5 border",
                    seq.active
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-muted-foreground bg-muted border-border"
                  )}
                >
                  {seq.active ? "Active" : "Paused"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {seq.stepCount} steps · triggered by{" "}
                <span className="font-medium text-muted-foreground">
                  {seq.triggerRule}
                </span>
              </p>
            </div>

            <div className="text-right hidden sm:block shrink-0">
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {seq.enrollments}
              </p>
              <p className="text-xs text-muted-foreground">enrollments</p>
            </div>

            <ChevronRight className="size-4 text-muted-foreground/40 shrink-0" />
          </div>
        ))
      )}
    </div>
  );
}

function EnrollmentsTab() {
  const activeEnrollments = MOCK_ENROLLMENTS.filter(
    (e) => e.status === "active"
  );

  return (
    <div className="flex flex-col gap-3">
      {MOCK_ENROLLMENTS.length === 0 ? (
        <EmptyState
          label="No active enrollments"
          description="Contacts will be enrolled here when a rule triggers a sequence."
        />
      ) : (
        <>
          {activeEnrollments.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {activeEnrollments.length} contact
              {activeEnrollments.length !== 1 ? "s" : ""} waiting for next step
            </p>
          )}
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {MOCK_ENROLLMENTS.map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                {/* Avatar */}
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                  {initials(enrollment.contact.displayName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {enrollment.contact.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {enrollment.sequence} · Step {enrollment.currentStep} of{" "}
                    {enrollment.totalSteps}
                  </p>
                </div>

                {/* Step progress */}
                <div className="flex gap-1 items-center shrink-0 hidden sm:flex">
                  {Array.from({ length: enrollment.totalSteps }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 w-6 rounded-full",
                        i < enrollment.currentStep
                          ? "bg-primary"
                          : "bg-muted-foreground/20"
                      )}
                    />
                  ))}
                </div>

                {/* Next step / status */}
                <div className="text-right shrink-0">
                  {enrollment.status === "active" ? (
                    <>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                        <Clock className="size-3" />
                        Next step
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {enrollment.nextStepAt}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5">
                      Complete
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center text-center gap-2">
      <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
        <GitBranch className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mt-2">{label}</p>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {description}
      </p>
    </div>
  );
}
