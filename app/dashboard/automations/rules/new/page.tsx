"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, X, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type TriggerType = "keyword" | "story_reply";

const TRIGGER_OPTIONS: {
  value: TriggerType;
  label: string;
  description: string;
}[] = [
  {
    value: "keyword",
    label: "Keyword match",
    description: "Trigger when an incoming DM contains one of your keywords.",
  },
  {
    value: "story_reply",
    label: "Story reply",
    description: "Trigger when someone replies to one of your stories.",
  },
];

export default function NewRulePage() {
  const router = useRouter();
  const options = useQuery(api.automations.rules.getRuleCreationOptions);
  const createRule = useMutation(api.automations.rules.createRule);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("keyword");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<Id<"tags">[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] =
    useState<Id<"sequenceDefinitions"> | null>(null);

  function addKeyword() {
    const trimmed = keywordInput.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((previous) => [...previous, trimmed]);
    }
    setKeywordInput("");
  }

  function removeKeyword(keyword: string) {
    setKeywords((previous) => previous.filter((item) => item !== keyword));
  }

  function toggleTag(tagId: Id<"tags">) {
    setSelectedTagIds((previous) =>
      previous.includes(tagId)
        ? previous.filter((item) => item !== tagId)
        : [...previous, tagId],
    );
  }

  async function handleSubmit() {
    const result = await createRule({
      name,
      triggerType,
      matchType: "contains",
      keywords,
      replyText,
      isActive,
      tagIds: selectedTagIds,
      sequenceDefinitionId: selectedSequenceId,
    });

    router.push(`/dashboard/automations/rules/${result.ruleId}`);
  }

  const isValid =
    name.trim().length > 0 &&
    replyText.trim().length > 0 &&
    (triggerType === "story_reply" || keywords.length > 0) &&
    Boolean(options?.hasConnectedAccount);

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-2xl w-full flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Link
            href="/dashboard/automations"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="size-3.5" />
            Back to automations
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              New DM rule
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Define a trigger, reply, tags, and an optional follow-up sequence.
            </p>
          </div>
        </div>

        {!options?.hasConnectedAccount ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Connect an Instagram account before creating rules.
          </div>
        ) : null}

        <div className="flex flex-col gap-6">
          <FormField
            label="Rule name"
            hint="A short name to identify this rule."
          >
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Pricing inquiry"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
            />
          </FormField>

          <FormField label="Trigger type" hint="When should this rule fire?">
            <div className="flex flex-col gap-2">
              {TRIGGER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                    triggerType === option.value
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="triggerType"
                    value={option.value}
                    checked={triggerType === option.value}
                    onChange={() => setTriggerType(option.value)}
                    className="mt-0.5 accent-primary shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </FormField>

          {triggerType === "keyword" ? (
            <FormField
              label="Keywords"
              hint="Press Enter or comma to add. Matching is case-insensitive."
            >
              <div className="flex flex-col gap-2">
                {keywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1 text-xs font-mono bg-muted border border-border rounded-md px-2 py-1 text-foreground"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(event) => setKeywordInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="Type a keyword and press Enter"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
                  />
                  <button
                    type="button"
                    onClick={addKeyword}
                    disabled={!keywordInput.trim()}
                    className="inline-flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    Add
                  </button>
                </div>
              </div>
            </FormField>
          ) : null}

          <FormField
            label="Reply message"
            hint={`${replyText.length}/1000 characters. Automated replies must stay within Meta policy limits.`}
          >
            <textarea
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="Type the message to send when this rule is triggered..."
              rows={4}
              maxLength={1000}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition resize-none"
            />
          </FormField>

          <FormField
            label="Tags"
            hint="Apply tags automatically when the rule fires."
          >
            <div className="flex flex-wrap gap-2">
              {options?.tags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField
            label="Follow-up sequence"
            hint="Optionally enroll the contact into one delayed sequence."
          >
            <select
              value={selectedSequenceId ?? ""}
              onChange={(event) =>
                setSelectedSequenceId(
                  event.target.value
                    ? (event.target.value as Id<"sequenceDefinitions">)
                    : null,
                )
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
            >
              <option value="">No sequence</option>
              {options?.sequences.map((sequence) => (
                <option key={sequence.id} value={sequence.id}>
                  {sequence.name} ({sequence.stepCount} steps)
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">
                Enable this rule
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rules can be paused at any time without deleting them.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((value) => !value)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                isActive ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Link
              href="/dashboard/automations"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={!isValid}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Save rule
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
