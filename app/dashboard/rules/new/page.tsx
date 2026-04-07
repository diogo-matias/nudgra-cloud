"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, X, Plus } from "lucide-react";

type TriggerType = "keyword" | "story_reaction" | "story_reply";

const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string }[] = [
  {
    value: "keyword",
    label: "Keyword match",
    description: "Trigger when an incoming DM contains one of your keywords.",
  },
  {
    value: "story_reaction",
    label: "Story reaction",
    description: "Trigger when someone reacts to one of your stories.",
  },
  {
    value: "story_reply",
    label: "Story reply",
    description: "Trigger when someone replies to one of your stories.",
  },
];

export default function NewRulePage() {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("keyword");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [reply, setReply] = useState("");
  const [active, setActive] = useState(true);

  function addKeyword() {
    const trimmed = keywordInput.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
    }
    setKeywordInput("");
  }

  function removeKeyword(kw: string) {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }

  function handleKeywordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword();
    }
  }

  const isValid = name.trim().length > 0 && reply.trim().length > 0;

  return (
    <main className="flex-1 px-8 py-10">
      <div className="max-w-2xl w-full flex flex-col gap-8">
        {/* Back + Header */}
        <div className="flex flex-col gap-4">
          <Link
            href="/dashboard/rules"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="size-3.5" />
            Back to rules
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">New rule</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Define a trigger and an automated reply.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-6">
          {/* Rule name */}
          <FormField label="Rule name" hint="A short name to identify this rule.">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pricing inquiry"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
            />
          </FormField>

          {/* Trigger type */}
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

          {/* Keywords (only for keyword trigger) */}
          {triggerType === "keyword" && (
            <FormField
              label="Keywords"
              hint="Press Enter or comma to add. Case-insensitive."
            >
              <div className="flex flex-col gap-2">
                {/* Tags */}
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 text-xs font-mono bg-muted border border-border rounded-md px-2 py-1 text-foreground"
                      >
                        {kw}
                        <button
                          onClick={() => removeKeyword(kw)}
                          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {/* Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    placeholder="Type a keyword and press Enter"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
                  />
                  <button
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
          )}

          {/* Reply message */}
          <FormField
            label="Reply message"
            hint={`${reply.length}/1000 characters. Automated replies must stay within Meta policy limits.`}
          >
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type the message to send when this rule is triggered..."
              rows={4}
              maxLength={1000}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition resize-none"
            />
          </FormField>

          {/* Active toggle */}
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
              onClick={() => setActive((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                active ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
                  active ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Link
              href="/dashboard/rules"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
            <button
              disabled={!isValid}
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
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
