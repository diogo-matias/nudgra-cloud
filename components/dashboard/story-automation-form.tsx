"use client";

import type { ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  LinkButtonsEditor,
  type LinkButtonConfig,
} from "@/components/dashboard/link-buttons-editor";
import { StoryAutomationPreview } from "@/components/dashboard/story-automation-preview";
import {
  InlineWarning,
  ToggleCard,
  ValidationIssuesNotice,
} from "@/components/dashboard/automation-shared-ui";
import { mergeStoryAutomationTokens } from "@/lib/story-automation-ui";
import { Image as ImageIcon, Plus, X } from "lucide-react";

type TagOption = {
  id: Id<"tags">;
  label: string;
  color: string;
};

type SelectedStory = {
  id: string;
  mediaType: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
} | null;

type StoryAutomationFormProps = {
  name: string;
  onNameChange: (value: string) => void;
  storyScope: "any" | "specific";
  onStoryScopeChange: (value: "any" | "specific") => void;
  selectedStory: SelectedStory;
  selectedStoryExpiredAt?: number | null;
  onPickStory: () => void;
  replyFilter: "specific_words_or_reactions" | "any_word_or_reaction";
  onReplyFilterChange: (
    value: "specific_words_or_reactions" | "any_word_or_reaction",
  ) => void;
  triggerTokens: string[];
  tokenInput: string;
  onTokenInputChange: (value: string) => void;
  onTriggerTokensChange: (tokens: string[]) => void;
  reactionEnabled: boolean;
  onReactionEnabledChange: (enabled: boolean) => void;
  followGateEnabled: boolean;
  onFollowGateEnabledChange: (enabled: boolean) => void;
  followGateText: string;
  onFollowGateTextChange: (value: string) => void;
  emailCollectionEnabled: boolean;
  onEmailCollectionEnabledChange: (enabled: boolean) => void;
  emailCollectionText: string;
  onEmailCollectionTextChange: (value: string) => void;
  linkDmText: string;
  onLinkDmTextChange: (value: string) => void;
  linkButtons: LinkButtonConfig[];
  onLinkButtonsChange: (links: LinkButtonConfig[]) => void;
  followUpEnabled: boolean;
  onFollowUpEnabledChange: (enabled: boolean) => void;
  followUpText: string;
  onFollowUpTextChange: (value: string) => void;
  tagOptions: TagOption[];
  selectedTagIds: Id<"tags">[];
  onSelectedTagIdsChange: (tagIds: Id<"tags">[]) => void;
  isActive?: boolean;
  onIsActiveChange?: (value: boolean) => void;
  showStatusToggle?: boolean;
  validationIssues: string[];
  submissionError?: string | null;
  username?: string | null;
  profilePictureUrl?: string | null;
};

const EXAMPLE_TOKENS = ["link", "guide", "🔥"];

export function StoryAutomationForm(props: StoryAutomationFormProps) {
  function addToken() {
    props.onTriggerTokensChange(
      mergeStoryAutomationTokens(props.triggerTokens, props.tokenInput),
    );
    props.onTokenInputChange("");
  }

  function removeToken(token: string) {
    props.onTriggerTokensChange(
      props.triggerTokens.filter((current) => current !== token),
    );
  }

  function addExampleToken(token: string) {
    props.onTriggerTokensChange(
      mergeStoryAutomationTokens(props.triggerTokens, token),
    );
  }

  function toggleTag(tagId: Id<"tags">) {
    props.onSelectedTagIdsChange(
      props.selectedTagIds.includes(tagId)
        ? props.selectedTagIds.filter((current) => current !== tagId)
        : [...props.selectedTagIds, tagId],
    );
  }

  const selectedStoryPreviewUrl =
    props.selectedStory?.thumbnailUrl || props.selectedStory?.mediaUrl || null;

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
              placeholder="e.g. Story link automation"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </FormField>

          <section className="flex flex-col gap-3">
            <h2 className="text-[2rem] font-bold leading-tight text-foreground">
              When someone replies to
            </h2>

            <OptionCard
              selected={props.storyScope === "any"}
              onClick={() => props.onStoryScopeChange("any")}
            >
              <div className="flex items-center gap-3">
                <RadioCircle selected={props.storyScope === "any"} />
                <span className="text-sm font-medium text-foreground">
                  any story
                </span>
              </div>
            </OptionCard>

            <OptionCard
              selected={props.storyScope === "specific"}
              onClick={() => props.onStoryScopeChange("specific")}
            >
              <div className="flex items-center gap-3">
                <RadioCircle selected={props.storyScope === "specific"} />
                <span className="text-sm font-medium text-foreground">
                  a specific story
                </span>
              </div>

              {props.storyScope === "specific" ? (
                <div className="ml-8 mt-3 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onPickStory();
                    }}
                    className="inline-flex w-fit items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {props.selectedStory ? "Change story" : "Pick a story"}
                  </button>

                  {props.selectedStory ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3">
                      <div className="relative h-24 w-[68px] overflow-hidden rounded-xl bg-muted">
                        {selectedStoryPreviewUrl ? (
                          <img
                            src={selectedStoryPreviewUrl}
                            alt="Selected story"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon className="size-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          Story selected
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {props.selectedStory.mediaType ?? "Story"}{" "}
                          {props.selectedStory.timestamp
                            ? `· ${new Date(
                                props.selectedStory.timestamp,
                              ).toLocaleString()}`
                            : ""}
                        </p>
                        {(props.selectedStoryExpiredAt ?? null) !== null ? (
                          <p className="mt-2 text-xs font-medium text-amber-700">
                            This story has expired. Pick a new one before going
                            live.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <InlineWarning text="Choose one currently live story to activate this scope." />
                  )}
                </div>
              ) : null}
            </OptionCard>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[2rem] font-bold leading-tight text-foreground">
              And this reply has
            </h2>

            <OptionCard
              selected={props.replyFilter === "specific_words_or_reactions"}
              onClick={() => props.onReplyFilterChange("specific_words_or_reactions")}
            >
              <div className="flex items-center gap-3">
                <RadioCircle
                  selected={props.replyFilter === "specific_words_or_reactions"}
                />
                <span className="text-sm font-medium text-foreground">
                  specific words or reactions
                </span>
              </div>

              {props.replyFilter === "specific_words_or_reactions" ? (
                <div className="mt-3 ml-8 flex flex-col gap-2">
                  {props.triggerTokens.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {props.triggerTokens.map((token) => (
                        <span
                          key={token}
                          className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
                        >
                          {token}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeToken(token);
                            }}
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
                      value={props.tokenInput}
                      onChange={(event) =>
                        props.onTokenInputChange(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          addToken();
                        }
                      }}
                      placeholder="Enter words or emojis"
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                    <button
                      type="button"
                      onClick={addToken}
                      disabled={!props.tokenInput.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="size-3.5" />
                      Add
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Use commas to separate words or emojis.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>For example:</span>
                    {EXAMPLE_TOKENS.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => addExampleToken(token)}
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </OptionCard>

            <OptionCard
              selected={props.replyFilter === "any_word_or_reaction"}
              onClick={() => props.onReplyFilterChange("any_word_or_reaction")}
            >
              <div className="flex items-center gap-3">
                <RadioCircle
                  selected={props.replyFilter === "any_word_or_reaction"}
                />
                <span className="text-sm font-medium text-foreground">
                  any word or reaction
                </span>
              </div>
            </OptionCard>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[2rem] font-bold leading-tight text-foreground">
              They&apos;ll get the DM with a link
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
                    maxLength={2000}
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
              label="React to story replies with ❤️"
              enabled={props.reactionEnabled}
              onToggle={props.onReactionEnabledChange}
            />

            <ToggleCard
              label="Follow up to grow engagement"
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
              label="Ask to follow before sending the link"
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
                      placeholder="Nearly there! The link is especially for my followers ✨"
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
              label="Ask for email"
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
                Apply tags automatically as soon as this automation matches.
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

            {props.showStatusToggle === false ? null : (
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Enable this automation
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Turn this on when you&apos;re ready for it to reply
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
        <StoryAutomationPreview
          config={{
            storyScope: props.storyScope,
            selectedStory: props.selectedStory,
            replyFilter: props.replyFilter,
            triggerTokens: props.triggerTokens,
            reactionEnabled: props.reactionEnabled,
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

function RadioCircle({ selected }: { selected: boolean }) {
  return (
    <div
      className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
        selected ? "border-primary" : "border-muted-foreground/40"
      }`}
    >
      {selected && <div className="size-2.5 rounded-full bg-primary" />}
    </div>
  );
}

function OptionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`rounded-xl border bg-card px-4 py-3 cursor-pointer transition-colors ${
        selected
          ? "border-primary/30 bg-primary/[0.02]"
          : "border-border hover:bg-muted/50"
      }`}
    >
      {children}
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
