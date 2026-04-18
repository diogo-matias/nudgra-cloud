"use client";

import Image from "next/image";
import type { SetStateAction } from "react";
import { HelpCircle, Image as ImageIcon, Info, Plus, X } from "lucide-react";
import { CommentAutomationPreview } from "@/components/dashboard/comment-automation-preview";
import {
  LinkButtonsEditor,
  type LinkButtonConfig,
} from "@/components/dashboard/link-buttons-editor";
import {
  InlineWarning,
  OptionCard,
  RadioCircle,
  ToggleCard,
  ValidationIssuesNotice,
} from "@/components/dashboard/automation-shared-ui";
import type {
  CommentAutomationFormValues,
  LinkLike,
} from "@/lib/comment-automation-ui";
import { mergeCommentAutomationKeywords } from "@/lib/comment-automation-ui";

type MediaOption = {
  mediaId: string;
  mediaType?: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  caption: string | null;
};

type CommentAutomationFormProps = {
  values: CommentAutomationFormValues;
  onValuesChange: (value: SetStateAction<CommentAutomationFormValues>) => void;
  keywordInput: string;
  onKeywordInputChange: (value: string) => void;
  media: MediaOption[];
  validationIssues: string[];
  submissionError?: string | null;
  username?: string | null;
  profilePictureUrl?: string | null;
  onPickPosts: () => void;
  onShowOpeningDmInfo: () => void;
};

const EXAMPLE_KEYWORDS = ["Price", "Link", "Shop"];

export function CommentAutomationForm(props: CommentAutomationFormProps) {
  const selectedMedia = props.media.filter((item) =>
    props.values.selectedMediaIds.includes(item.mediaId),
  );

  function updateValues(
    updater:
      | Partial<CommentAutomationFormValues>
      | ((current: CommentAutomationFormValues) => CommentAutomationFormValues),
  ) {
    if (typeof updater === "function") {
      props.onValuesChange(updater);
      return;
    }

    props.onValuesChange((current) => ({ ...current, ...updater }));
  }

  function addKeyword() {
    updateValues((current) => ({
      ...current,
      triggerKeywords: mergeCommentAutomationKeywords(
        current.triggerKeywords,
        props.keywordInput,
      ),
    }));
    props.onKeywordInputChange("");
  }

  function removeKeyword(keyword: string) {
    updateValues((current) => ({
      ...current,
      triggerKeywords: current.triggerKeywords.filter(
        (currentKeyword) => currentKeyword !== keyword,
      ),
    }));
  }

  function addCommentReplyText() {
    updateValues((current) => ({
      ...current,
      commentReplyTexts: [...current.commentReplyTexts, ""],
    }));
  }

  function updateCommentReplyText(index: number, text: string) {
    updateValues((current) => ({
      ...current,
      commentReplyTexts: current.commentReplyTexts.map((currentText, currentIndex) =>
        currentIndex === index ? text : currentText,
      ),
    }));
  }

  function removeCommentReplyText(index: number) {
    updateValues((current) => ({
      ...current,
      commentReplyTexts:
        current.commentReplyTexts.length <= 1
          ? current.commentReplyTexts
          : current.commentReplyTexts.filter(
              (_, currentIndex) => currentIndex !== index,
            ),
    }));
  }

  function addExampleKeyword(keyword: string) {
    updateValues((current) => ({
      ...current,
      triggerKeywords: mergeCommentAutomationKeywords(
        current.triggerKeywords,
        keyword,
      ),
    }));
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex max-w-xl flex-col gap-8">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Automation name
            </label>
            <input
              type="text"
              value={props.values.name}
              onChange={(event) => updateValues({ name: event.target.value })}
              placeholder="e.g. Free guide link"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          {props.validationIssues.length > 0 ? (
            <ValidationIssuesNotice
              title="Fix these items before saving"
              issues={props.validationIssues}
            />
          ) : null}

          {props.submissionError ? (
            <ValidationIssuesNotice
              title="Automation could not be saved"
              issues={[props.submissionError]}
            />
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-foreground">
              When someone comments on
            </h2>

            <OptionCard
              selected={props.values.postScope === "specific"}
              onClick={() => updateValues({ postScope: "specific" })}
            >
              <div className="flex items-center gap-3">
                <RadioCircle selected={props.values.postScope === "specific"} />
                <span className="text-sm font-medium text-foreground">
                  a specific post or reel
                </span>
              </div>

              {props.values.postScope === "specific" && props.media.length > 0 ? (
                <div className="ml-8 mt-3">
                  <div className="flex gap-2.5">
                    {props.media.slice(0, 4).map((item) => {
                      const imageUrl = item.thumbnailUrl || item.mediaUrl;
                      const isSelected = props.values.selectedMediaIds.includes(
                        item.mediaId,
                      );

                      return (
                        <button
                          key={item.mediaId}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            updateValues({
                              selectedMediaIds: isSelected ? [] : [item.mediaId],
                            });
                          }}
                          className={`relative h-[90px] w-[90px] overflow-hidden rounded-xl border-2 transition-all ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={item.caption ?? "Post"}
                              fill
                              unoptimized
                              sizes="90px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted">
                              <ImageIcon className="size-6 text-muted-foreground/40" />
                            </div>
                          )}
                          {item.caption ? (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3">
                              <p className="line-clamp-2 text-[8px] font-medium leading-tight text-white">
                                {item.caption}
                              </p>
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onPickPosts();
                    }}
                    className="mt-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Show all
                  </button>
                </div>
              ) : null}

              {props.values.postScope === "specific" && props.media.length === 0 ? (
                <div className="ml-8 mt-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onPickPosts();
                    }}
                    className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Select posts or reels
                  </button>
                </div>
              ) : null}
            </OptionCard>

            <OptionCard
              selected={props.values.postScope === "any"}
              onClick={() => updateValues({ postScope: "any" })}
            >
              <div className="flex items-center gap-3">
                <RadioCircle selected={props.values.postScope === "any"} />
                <span className="text-sm font-medium text-foreground">
                  any post or reel
                </span>
                <HelpCircle className="size-4 text-muted-foreground" />
              </div>
            </OptionCard>

            <OptionCard
              selected={props.values.postScope === "next"}
              onClick={() => updateValues({ postScope: "next" })}
            >
              <div className="flex items-center gap-3">
                <RadioCircle selected={props.values.postScope === "next"} />
                <span className="text-sm font-medium text-foreground">
                  next post or reel
                </span>
                <HelpCircle className="size-4 text-muted-foreground" />
              </div>
              {props.values.postScope === "next" ? (
                <p className="ml-8 mt-3 text-xs leading-relaxed text-muted-foreground">
                  This locks to the first new post or reel published after you go
                  live.
                </p>
              ) : null}
            </OptionCard>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-foreground">
              And this comment has
            </h2>

            <OptionCard
              selected={props.values.commentFilter === "specific_words"}
              onClick={() => updateValues({ commentFilter: "specific_words" })}
            >
              <div className="flex items-center gap-3">
                <RadioCircle
                  selected={props.values.commentFilter === "specific_words"}
                />
                <span className="text-sm font-medium text-foreground">
                  a specific word or words
                </span>
              </div>

              {props.values.commentFilter === "specific_words" ? (
                <div className="ml-8 mt-3 flex flex-col gap-2">
                  {props.values.triggerKeywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {props.values.triggerKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-foreground"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeKeyword(keyword);
                            }}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <input
                    type="text"
                    value={props.keywordInput}
                    onChange={(event) =>
                      props.onKeywordInputChange(event.target.value)
                    }
                    onBlur={() => {
                      if (props.keywordInput.trim()) {
                        addKeyword();
                      }
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="Enter a word or multiple"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />

                  <p className="text-xs text-muted-foreground">
                    Use commas to separate words
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      For example:
                    </span>
                    {EXAMPLE_KEYWORDS.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          addExampleKeyword(example);
                        }}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </OptionCard>

            <OptionCard
              selected={props.values.commentFilter === "any_word"}
              onClick={() => updateValues({ commentFilter: "any_word" })}
            >
              <div className="flex items-center gap-3">
                <RadioCircle selected={props.values.commentFilter === "any_word"} />
                <span className="text-sm font-medium text-foreground">
                  any word
                </span>
              </div>
            </OptionCard>

            <ToggleCard
              label="reply to their comments under the post"
              enabled={props.values.commentReplyEnabled}
              onToggle={(commentReplyEnabled) =>
                updateValues({ commentReplyEnabled })
              }
            >
              {props.values.commentReplyEnabled ? (
                <div className="mt-3 flex flex-col gap-2">
                  {props.values.commentReplyTexts.map((text, index) => (
                    <div key={`comment-reply-${index}`} className="flex gap-2">
                      <input
                        type="text"
                        value={text}
                        onChange={(event) =>
                          updateCommentReplyText(index, event.target.value)
                        }
                        placeholder="e.g. Thanks! Check your DMs"
                        className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
                      />
                      {props.values.commentReplyTexts.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeCommentReplyText(index)}
                          className="p-2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {props.values.commentReplyTexts.length < 5 ? (
                    <button
                      type="button"
                      onClick={addCommentReplyText}
                      className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Plus className="size-3" />
                      Add variation (random pick)
                    </button>
                  ) : null}
                </div>
              ) : null}
            </ToggleCard>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-foreground">They will get</h2>

            <ToggleCard
              label="an opening DM"
              enabled={props.values.openingDmEnabled}
              onToggle={(openingDmEnabled) =>
                updateValues({ openingDmEnabled })
              }
            >
              {props.values.openingDmEnabled ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <textarea
                      value={props.values.openingDmText}
                      onChange={(event) =>
                        updateValues({ openingDmText: event.target.value })
                      }
                      placeholder="Hey there! I'm so happy you're here..."
                      rows={3}
                      maxLength={500}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>

                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <input
                      type="text"
                      value={props.values.openingDmButtonText}
                      onChange={(event) =>
                        updateValues({
                          openingDmButtonText: event.target.value,
                        })
                      }
                      placeholder="Send me the link"
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={props.onShowOpeningDmInfo}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Info className="size-3" />
                    Why does an opening DM matter?
                  </button>
                </div>
              ) : null}
            </ToggleCard>

            <ToggleCard
              label="a DM asking to follow you before they get the link"
              enabled={props.values.followGateEnabled}
              onToggle={(followGateEnabled) =>
                updateValues({ followGateEnabled })
              }
            >
              {props.values.followGateEnabled ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <textarea
                      value={props.values.followGateText}
                      onChange={(event) =>
                        updateValues({ followGateText: event.target.value })
                      }
                      placeholder="Nearly there! The link is especially for my followers."
                      rows={2}
                      maxLength={500}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <InlineWarning text="Follow status is verified after the user interacts in DM. If Meta still requires profile consent, they'll be asked to send a reply so verification can complete." />
                </div>
              ) : null}
            </ToggleCard>

            <ToggleCard
              label="a DM asking for their email"
              enabled={props.values.emailCollectionEnabled}
              onToggle={(emailCollectionEnabled) =>
                updateValues({ emailCollectionEnabled })
              }
            >
              {props.values.emailCollectionEnabled ? (
                <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                  <textarea
                    value={props.values.emailCollectionText}
                    onChange={(event) =>
                      updateValues({ emailCollectionText: event.target.value })
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
              And then, they will get
            </h2>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  a DM with a link
                </p>
              </div>
              <div className="flex flex-col gap-3 px-4 pb-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <textarea
                    value={props.values.linkDmText}
                    onChange={(event) =>
                      updateValues({ linkDmText: event.target.value })
                    }
                    placeholder="Write a message"
                    rows={3}
                    maxLength={2000}
                    className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>

                <LinkButtonsEditor
                  links={props.values.linkButtons as LinkButtonConfig[]}
                  onChange={(linkButtons) =>
                    updateValues({ linkButtons: linkButtons as LinkLike[] })
                  }
                />
              </div>
            </div>

            <ToggleCard
              label="a follow up DM if they don't click the link"
              enabled={props.values.followUpEnabled}
              onToggle={(followUpEnabled) => updateValues({ followUpEnabled })}
            >
              {props.values.followUpEnabled ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <textarea
                      value={props.values.followUpText}
                      onChange={(event) =>
                        updateValues({ followUpText: event.target.value })
                      }
                      placeholder="Just checking in - did you get the link?"
                      rows={2}
                      maxLength={500}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  {props.values.linkButtons.length === 0 ? (
                    <InlineWarning text="Add at least one link button first. Follow-up only runs when clicks can be tracked." />
                  ) : (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Follow-up sends once, 6 hours after the link DM, only if no
                      tracked link click is recorded.
                    </p>
                  )}
                </div>
              ) : null}
            </ToggleCard>
          </section>

          <div className="h-8" />
        </div>
      </div>

      <div className="hidden w-[380px] shrink-0 items-start justify-center overflow-y-auto border-l border-border bg-muted/30 py-8 lg:flex">
        <CommentAutomationPreview
          config={{
            commentReplyEnabled: props.values.commentReplyEnabled,
            commentReplyTexts: props.values.commentReplyTexts,
            triggerKeywords: props.values.triggerKeywords,
            openingDmEnabled: props.values.openingDmEnabled,
            openingDmText: props.values.openingDmText,
            openingDmButtonText: props.values.openingDmButtonText,
            followGateEnabled: props.values.followGateEnabled,
            followGateText: props.values.followGateText,
            emailCollectionEnabled: props.values.emailCollectionEnabled,
            emailCollectionText: props.values.emailCollectionText,
            linkDmText: props.values.linkDmText,
            linkButtons: props.values.linkButtons as LinkButtonConfig[],
            followUpEnabled: props.values.followUpEnabled,
            followUpText: props.values.followUpText,
            validationIssues: props.validationIssues,
            username: props.username ?? undefined,
            profilePictureUrl: props.profilePictureUrl ?? undefined,
            selectedPostThumbnail:
              selectedMedia[0]?.thumbnailUrl || selectedMedia[0]?.mediaUrl || null,
            selectedPostCaption: selectedMedia[0]?.caption ?? null,
          }}
        />
      </div>
    </div>
  );
}
