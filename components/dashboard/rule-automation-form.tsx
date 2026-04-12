"use client";

import type { ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  LinkButtonsEditor,
  type LinkButtonConfig,
} from "@/components/dashboard/link-buttons-editor";
import { RuleAutomationPreview } from "@/components/dashboard/rule-automation-preview";
import {
  InlineWarning,
  ToggleCard,
  ValidationIssuesNotice,
} from "@/components/dashboard/automation-shared-ui";
import { mergeRuleAutomationKeywords } from "@/lib/rule-automation-ui";
import { Plus, X } from "lucide-react";

type TagOption = {
  id: Id<"tags">;
  label: string;
  color: string;
};

type SequenceOption = {
  id: Id<"sequenceDefinitions">;
  name: string;
  isActive: boolean;
  stepCount: number;
};

type RuleAutomationFormProps = {
  name: string;
  onNameChange: (value: string) => void;
  triggerKeywords: string[];
  keywordInput: string;
  onKeywordInputChange: (value: string) => void;
  onTriggerKeywordsChange: (keywords: string[]) => void;
  linkDmText: string;
  onLinkDmTextChange: (value: string) => void;
  linkButtons: LinkButtonConfig[];
  onLinkButtonsChange: (links: LinkButtonConfig[]) => void;
  followGateEnabled: boolean;
  onFollowGateEnabledChange: (enabled: boolean) => void;
  followGateText: string;
  onFollowGateTextChange: (value: string) => void;
  emailCollectionEnabled: boolean;
  onEmailCollectionEnabledChange: (enabled: boolean) => void;
  emailCollectionText: string;
  onEmailCollectionTextChange: (value: string) => void;
  followUpEnabled: boolean;
  onFollowUpEnabledChange: (enabled: boolean) => void;
  followUpText: string;
  onFollowUpTextChange: (value: string) => void;
  tagOptions: TagOption[];
  selectedTagIds: Id<"tags">[];
  onSelectedTagIdsChange: (tagIds: Id<"tags">[]) => void;
  sequenceOptions: SequenceOption[];
  selectedSequenceId: Id<"sequenceDefinitions"> | null;
  onSelectedSequenceIdChange: (
    sequenceId: Id<"sequenceDefinitions"> | null,
  ) => void;
  isActive?: boolean;
  onIsActiveChange?: (value: boolean) => void;
  showStatusToggle?: boolean;
  validationIssues: string[];
  submissionError?: string | null;
  username?: string | null;
  profilePictureUrl?: string | null;
};

const EXAMPLE_KEYWORDS = ["Price", "Link", "Shop"];

export function RuleAutomationForm(props: RuleAutomationFormProps) {
  function addKeyword() {
    props.onTriggerKeywordsChange(
      mergeRuleAutomationKeywords(props.triggerKeywords, props.keywordInput),
    );
    props.onKeywordInputChange("");
  }

  function removeKeyword(keyword: string) {
    props.onTriggerKeywordsChange(
      props.triggerKeywords.filter((current) => current !== keyword),
    );
  }

  function toggleTag(tagId: Id<"tags">) {
    props.onSelectedTagIdsChange(
      props.selectedTagIds.includes(tagId)
        ? props.selectedTagIds.filter((current) => current !== tagId)
        : [...props.selectedTagIds, tagId],
    );
  }

  function addExampleKeyword(keyword: string) {
    props.onTriggerKeywordsChange(
      mergeRuleAutomationKeywords(props.triggerKeywords, keyword),
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-8">
          {props.validationIssues.length > 0 ? (
            <ValidationIssuesNotice
              title="This automation needs a few fixes"
              issues={props.validationIssues}
            />
          ) : null}

          {props.submissionError ? (
            <ValidationIssuesNotice
              title="Unable to save automation"
              issues={[props.submissionError]}
            />
          ) : null}

          <FormField label="Automation name">
            <input
              type="text"
              value={props.name}
              onChange={(event) => props.onNameChange(event.target.value)}
              placeholder="e.g. Guide link DM"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </FormField>

          <section className="flex flex-col gap-3">
            <h2 className="text-[2rem] font-bold leading-tight text-foreground">
              When someone DMs you with
            </h2>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                a specific word or words
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {props.triggerKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {props.triggerKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="text-sky-500 transition-colors hover:text-sky-700"
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
                    value={props.keywordInput}
                    onChange={(event) =>
                      props.onKeywordInputChange(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="Enter a word or multiple"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                  <button
                    type="button"
                    onClick={addKeyword}
                    disabled={!props.keywordInput.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                    Add
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Use commas to separate words
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>For example:</span>
                  {EXAMPLE_KEYWORDS.map((keyword) => (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => addExampleKeyword(keyword)}
                      className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[2rem] font-bold leading-tight text-foreground">
              They&apos;ll get a DM back from you
            </h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  a DM with a link
                </p>
              </div>
              <div className="flex flex-col gap-3 px-4 pb-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <textarea
                    value={props.linkDmText}
                    onChange={(event) =>
                      props.onLinkDmTextChange(event.target.value)
                    }
                    placeholder="Write a message"
                    rows={4}
                    maxLength={500}
                    className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>

                <LinkButtonsEditor
                  links={props.linkButtons}
                  onChange={props.onLinkButtonsChange}
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[2rem] font-bold leading-tight text-foreground">
              Other things to automate
            </h2>

            <ToggleCard
              label="Follow up to re-engage and build trust"
              enabled={props.followUpEnabled}
              onToggle={props.onFollowUpEnabledChange}
            >
              {props.followUpEnabled ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <textarea
                      value={props.followUpText}
                      onChange={(event) =>
                        props.onFollowUpTextChange(event.target.value)
                      }
                      placeholder="Just checking in - did you get the link?"
                      rows={2}
                      maxLength={500}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  {props.linkButtons.length === 0 ? (
                    <InlineWarning text="Add at least one link button first. Follow-up only runs when clicks can be tracked." />
                  ) : (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Follow-up sends once, 6 hours after the link DM, only if
                      no tracked link click is recorded.
                    </p>
                  )}
                </div>
              ) : null}
            </ToggleCard>

            <ToggleCard
              label="Automatically ask for a follow to build your audience"
              enabled={props.followGateEnabled}
              onToggle={props.onFollowGateEnabledChange}
            >
              {props.followGateEnabled ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <textarea
                      value={props.followGateText}
                      onChange={(event) =>
                        props.onFollowGateTextChange(event.target.value)
                      }
                      placeholder="To get the link, please follow our account first!"
                      rows={2}
                      maxLength={500}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <InlineWarning text="Follow status is verified after the user interacts in DM. If Meta still requires profile consent, they'll be asked to send another reply so verification can complete." />
                </div>
              ) : null}
            </ToggleCard>

            <ToggleCard
              label="Ask for emails in DMs to keep in touch beyond social"
              enabled={props.emailCollectionEnabled}
              onToggle={props.onEmailCollectionEnabledChange}
            >
              {props.emailCollectionEnabled ? (
                <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                  <textarea
                    value={props.emailCollectionText}
                    onChange={(event) =>
                      props.onEmailCollectionTextChange(event.target.value)
                    }
                    placeholder="Drop your email and we'll send it right over:"
                    rows={2}
                    maxLength={500}
                    className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              ) : null}
            </ToggleCard>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-foreground">
              Advanced settings
            </h2>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Tags</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Apply tags automatically as soon as this rule matches.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {props.tagOptions.map((tag) => {
                  const selected = props.selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                Follow-up sequence
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Optionally enroll the contact into one delayed sequence on match.
              </p>
              <select
                value={props.selectedSequenceId ?? ""}
                onChange={(event) =>
                  props.onSelectedSequenceIdChange(
                    event.target.value
                      ? (event.target.value as Id<"sequenceDefinitions">)
                      : null,
                  )
                }
                className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">No sequence</option>
                {props.sequenceOptions.map((sequence) => (
                  <option key={sequence.id} value={sequence.id}>
                    {sequence.name} ({sequence.stepCount} steps)
                  </option>
                ))}
              </select>
            </div>

            {props.showStatusToggle === false ? null : (
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Enable this rule
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Turn this on when you're ready for it to reply
                    automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => props.onIsActiveChange?.(!(props.isActive ?? true))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    (props.isActive ?? true)
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
                      props.isActive ?? true
                        ? "translate-x-4"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            )}
          </section>

          <div className="h-8" />
        </div>
      </div>

      <div className="hidden w-[380px] shrink-0 items-start justify-center overflow-y-auto border-l border-border bg-muted/30 py-8 lg:flex">
        <RuleAutomationPreview
          config={{
            triggerKeywords: props.triggerKeywords,
            followGateEnabled: props.followGateEnabled,
            followGateText: props.followGateText,
            emailCollectionEnabled: props.emailCollectionEnabled,
            emailCollectionText: props.emailCollectionText,
            linkDmText: props.linkDmText,
            linkButtons: props.linkButtons,
            followUpEnabled: props.followUpEnabled,
            followUpText: props.followUpText,
            validationIssues: props.validationIssues,
            username: props.username,
            profilePictureUrl: props.profilePictureUrl,
          }}
        />
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
