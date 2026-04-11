"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  X,
  Plus,
  HelpCircle,
  Info,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { PostPickerModal } from "@/components/dashboard/post-picker-modal";
import { CommentAutomationPreview } from "@/components/dashboard/comment-automation-preview";
import {
  LinkButtonsEditor,
  type LinkButtonConfig,
} from "@/components/dashboard/link-buttons-editor";
import { OpeningDmInfoModal } from "@/components/dashboard/opening-dm-info-modal";
import {
  getNormalizedCommentAutomationKeywords,
  getCommentAutomationFormValidationIssues,
  mergeCommentAutomationKeywords,
} from "@/lib/comment-automation-ui";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";

type PostScope = "specific" | "any" | "next";
type CommentFilter = "specific_words" | "any_word";

export default function NewCommentAutomationPage() {
  const router = useRouter();
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;
  const createAutomation = useMutation(
    api.automations.commentAutomations.createCommentAutomation,
  );
  const media =
    useQuery(
      api.meta.mediaQueries.listCachedMedia,
      selectedAccount ? { accountId: selectedAccount.id } : "skip",
    ) ?? [];

  // General
  const [name, setName] = useState("");

  // Post selection
  const [postScope, setPostScope] = useState<PostScope>("specific");
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [showPostPicker, setShowPostPicker] = useState(false);
  const [showDmInfo, setShowDmInfo] = useState(false);

  // Comment filter
  const [commentFilter, setCommentFilter] =
    useState<CommentFilter>("specific_words");
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  // Comment reply
  const [commentReplyEnabled, setCommentReplyEnabled] = useState(true);
  const [commentReplyTexts, setCommentReplyTexts] = useState<string[]>([
    "Thanks! Check your DMs",
  ]);

  // Opening DM
  const [openingDmEnabled, setOpeningDmEnabled] = useState(true);
  const [openingDmText, setOpeningDmText] = useState(
    "Hey! Thanks for your interest. Click below to get the link:",
  );
  const [openingDmButtonText, setOpeningDmButtonText] =
    useState("Send me the link");

  // Follow gate
  const [followGateEnabled, setFollowGateEnabled] = useState(false);
  const [followGateText, setFollowGateText] = useState(
    "To get the link, please follow our account first!",
  );

  // Email collection
  const [emailCollectionEnabled, setEmailCollectionEnabled] = useState(false);
  const [emailCollectionText, setEmailCollectionText] = useState(
    "Drop your email and we'll send it right over:",
  );

  // Link delivery
  const [linkDmText, setLinkDmText] = useState("Here's your link:");
  const [linkButtons, setLinkButtons] = useState<LinkButtonConfig[]>([]);

  // Follow-up
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpText, setFollowUpText] = useState(
    "Just checking — did you get the link? Let me know if you need anything!",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Get selected media items for thumbnail previews
  const selectedMedia = media.filter((m) =>
    selectedMediaIds.includes(m.mediaId),
  );
  const mergedTriggerKeywords = mergeCommentAutomationKeywords(
    triggerKeywords,
    keywordInput,
  );
  const normalizedTriggerKeywords = getNormalizedCommentAutomationKeywords(
    triggerKeywords,
    keywordInput,
  );

  function addKeyword() {
    setTriggerKeywords((prev) =>
      mergeCommentAutomationKeywords(prev, keywordInput),
    );
    setKeywordInput("");
  }

  function removeKeyword(keyword: string) {
    setTriggerKeywords((prev) => prev.filter((k) => k !== keyword));
  }

  function addCommentReplyText() {
    setCommentReplyTexts((prev) => [...prev, ""]);
  }

  function updateCommentReplyText(index: number, text: string) {
    setCommentReplyTexts((prev) =>
      prev.map((t, i) => (i === index ? text : t)),
    );
  }

  function removeCommentReplyText(index: number) {
    if (commentReplyTexts.length <= 1) return;
    setCommentReplyTexts((prev) => prev.filter((_, i) => i !== index));
  }

  function addExampleKeyword(keyword: string) {
    setTriggerKeywords((prev) => mergeCommentAutomationKeywords(prev, keyword));
  }

  const validationIssues = getCommentAutomationFormValidationIssues({
    name,
    postScope,
    selectedMediaIds,
    commentFilter,
    triggerKeywords: mergedTriggerKeywords,
    followGateEnabled,
    linkDmText,
    linkButtons,
    followUpEnabled,
  });
  const isValid = validationIssues.length === 0;

  async function handleSubmit(goLive: boolean) {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const primaryLink = linkButtons[0] ?? null;
      const result = await createAutomation({
        accountId: selectedAccount!.id,
        name,
        postScope,
        selectedMediaIds,
        commentFilter,
        triggerKeywords: normalizedTriggerKeywords,
        triggerKeywordLabels: mergedTriggerKeywords,
        commentReplyEnabled,
        commentReplyTexts: commentReplyTexts.filter((t) => t.trim()),
        openingDmEnabled,
        openingDmText,
        openingDmButtonText,
        followGateEnabled,
        followGateText,
        emailCollectionEnabled,
        emailCollectionText,
        linkDmText,
        linkButtons,
        linkUrl: primaryLink?.url ?? "",
        linkButtonText: primaryLink?.label ?? "Open link",
        followUpEnabled,
        followUpText,
        goLive,
      });

      router.push(`/dashboard/automations/comments/${result.automationId}`);
    } catch (error) {
      console.error("Failed to create automation:", error);
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Failed to create automation.",
      );
      setIsSubmitting(false);
    }
  }

  if (selectedAccount === null) {
    return (
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active Instagram account from the sidebar before creating a comment automation."
        />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="border-b border-border bg-background px-8 py-4 shrink-0">
        <div className="flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/automations"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Automations
            </Link>
            <span className="text-border">/</span>
              <span className="text-sm font-medium text-foreground">
                New comment automation
              </span>
            </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isValid || isSubmitting}
              onClick={() => void handleSubmit(false)}
              className="inline-flex items-center border border-border rounded-lg px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Save as draft
            </button>
            <button
              type="button"
              disabled={!isValid || isSubmitting}
              onClick={() => void handleSubmit(true)}
              className="inline-flex items-center bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Go live
            </button>
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left panel: Form */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="max-w-xl flex flex-col gap-8">
            {/* Automation name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Automation name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Free guide link"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
              />
            </div>

            {validationIssues.length > 0 ? (
              <ValidationIssuesNotice
                title="Fix these items before saving"
                issues={validationIssues}
              />
            ) : null}

            {submissionError ? (
              <ValidationIssuesNotice
                title="Automation could not be saved"
                issues={[submissionError]}
              />
            ) : null}

            {/* ─── Section 1: When someone comments on ─────────── */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-foreground">
                When someone comments on
              </h2>

              {/* Specific post or reel */}
              <OptionCard
                selected={postScope === "specific"}
                onClick={() => setPostScope("specific")}
              >
                <div className="flex items-center gap-3">
                  <RadioCircle selected={postScope === "specific"} />
                  <span className="text-sm font-medium text-foreground">
                    a specific post or reel
                  </span>
                </div>

                {/* Inline post thumbnails — always show latest posts */}
                {postScope === "specific" && media.length > 0 && (
                  <div className="mt-3 ml-8">
                    <div className="flex gap-2.5">
                      {media.slice(0, 4).map((item) => {
                        const imageUrl = item.thumbnailUrl || item.mediaUrl;
                        const isSelected = selectedMediaIds.includes(
                          item.mediaId,
                        );
                        return (
                          <button
                            key={item.mediaId}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMediaIds(
                                isSelected ? [] : [item.mediaId],
                              );
                            }}
                            className={`relative w-[90px] h-[90px] rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                              isSelected
                                ? "border-primary ring-2 ring-primary/30"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={item.caption ?? "Post"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted" />
                            )}
                            {/* Caption overlay */}
                            {item.caption && (
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-3 pb-1">
                                <p className="text-[8px] text-white leading-tight line-clamp-2 font-medium">
                                  {item.caption}
                                </p>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPostPicker(true);
                      }}
                      className="text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer mt-2"
                    >
                      Show All
                    </button>
                  </div>
                )}

                {/* Fallback if no media cached yet */}
                {postScope === "specific" && media.length === 0 && (
                  <div className="mt-3 ml-8">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPostPicker(true);
                      }}
                      className="text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                    >
                      Select posts or reels
                    </button>
                  </div>
                )}
              </OptionCard>

              {/* Any post or reel */}
              <OptionCard
                selected={postScope === "any"}
                onClick={() => setPostScope("any")}
              >
                <div className="flex items-center gap-3">
                  <RadioCircle selected={postScope === "any"} />
                  <span className="text-sm font-medium text-foreground">
                    any post or reel
                  </span>
                  <HelpCircle className="size-4 text-muted-foreground" />
                </div>
              </OptionCard>

              {/* Next post or reel */}
              <OptionCard
                selected={postScope === "next"}
                onClick={() => setPostScope("next")}
              >
                <div className="flex items-center gap-3">
                  <RadioCircle selected={postScope === "next"} />
                  <span className="text-sm font-medium text-foreground">
                    next post or reel
                  </span>
                  <HelpCircle className="size-4 text-muted-foreground" />
                </div>
                {postScope === "next" ? (
                  <p className="mt-3 ml-8 text-xs leading-relaxed text-muted-foreground">
                    This locks to the first new post or reel published after you
                    go live.
                  </p>
                ) : null}
              </OptionCard>
            </div>

            {/* ─── Section 2: And this comment has ─────────────── */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-foreground">
                And this comment has
              </h2>

              {/* Specific word or words */}
              <OptionCard
                selected={commentFilter === "specific_words"}
                onClick={() => setCommentFilter("specific_words")}
              >
                <div className="flex items-center gap-3">
                  <RadioCircle selected={commentFilter === "specific_words"} />
                  <span className="text-sm font-medium text-foreground">
                    a specific word or words
                  </span>
                </div>

                {commentFilter === "specific_words" && (
                  <div className="mt-3 ml-8 flex flex-col gap-2">
                    {/* Keyword chips */}
                    {triggerKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {triggerKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-flex items-center gap-1 text-xs font-mono bg-muted border border-border rounded-md px-2 py-1 text-foreground"
                          >
                            {keyword}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeKeyword(keyword);
                              }}
                              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Input */}
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onBlur={() => {
                        if (keywordInput.trim()) {
                          addKeyword();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addKeyword();
                        }
                      }}
                      placeholder="Enter a word or multiple"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
                    />

                    <p className="text-xs text-muted-foreground">
                      Use commas to separate words
                    </p>

                    {/* Example keywords */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        For example:
                      </span>
                      {["Price", "Link", "Shop"].map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addExampleKeyword(example);
                          }}
                          className="text-xs border border-border rounded-md px-2.5 py-1 text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </OptionCard>

              {/* Any word */}
              <OptionCard
                selected={commentFilter === "any_word"}
                onClick={() => setCommentFilter("any_word")}
              >
                <div className="flex items-center gap-3">
                  <RadioCircle selected={commentFilter === "any_word"} />
                  <span className="text-sm font-medium text-foreground">
                    any word
                  </span>
                </div>
              </OptionCard>

              {/* Comment reply toggle */}
              <ToggleCard
                label="reply to their comments under the post"
                enabled={commentReplyEnabled}
                onToggle={setCommentReplyEnabled}
              >
                {commentReplyEnabled && (
                  <div className="mt-3 flex flex-col gap-2">
                    {commentReplyTexts.map((text, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={text}
                          onChange={(e) =>
                            updateCommentReplyText(index, e.target.value)
                          }
                          placeholder="e.g. Thanks! Check your DMs"
                          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
                        />
                        {commentReplyTexts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCommentReplyText(index)}
                            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-2"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {commentReplyTexts.length < 5 && (
                      <button
                        type="button"
                        onClick={addCommentReplyText}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
                      >
                        <Plus className="size-3" />
                        Add variation (random pick)
                      </button>
                    )}
                  </div>
                )}
              </ToggleCard>
            </div>

            {/* ─── Section 3: They will get ────────────────────── */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-foreground">
                They will get
              </h2>

              {/* Opening DM */}
              <ToggleCard
                label="an opening DM"
                enabled={openingDmEnabled}
                onToggle={setOpeningDmEnabled}
              >
                {openingDmEnabled && (
                  <div className="mt-3 flex flex-col gap-3">
                    {/* Message preview */}
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <textarea
                        value={openingDmText}
                        onChange={(e) => setOpeningDmText(e.target.value)}
                        placeholder="Hey! Thanks for your interest..."
                        rows={3}
                        maxLength={500}
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
                      />
                    </div>

                    {/* Button text */}
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <input
                        type="text"
                        value={openingDmButtonText}
                        onChange={(e) => setOpeningDmButtonText(e.target.value)}
                        placeholder="Send me the link"
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowDmInfo(true)}
                      className="text-xs text-primary flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Info className="size-3" />
                      Why does an Opening DM matter?
                    </button>
                  </div>
                )}
              </ToggleCard>

              {/* Follow gate */}
              <ToggleCard
                label="a DM asking to follow you before they get the link"
                enabled={followGateEnabled}
                onToggle={setFollowGateEnabled}
              >
                {followGateEnabled && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <textarea
                        value={followGateText}
                        onChange={(e) => setFollowGateText(e.target.value)}
                        placeholder="Please follow our account to get the link!"
                        rows={2}
                        maxLength={500}
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                    <InlineWarning text="Follow status is verified after the user interacts in DM. If Meta still requires profile consent, they'll be asked to send a reply so verification can complete." />
                  </div>
                )}
              </ToggleCard>

              {/* Email collection */}
              <ToggleCard
                label="a DM asking for their email"
                enabled={emailCollectionEnabled}
                onToggle={setEmailCollectionEnabled}
              >
                {emailCollectionEnabled && (
                  <div className="mt-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <textarea
                        value={emailCollectionText}
                        onChange={(e) => setEmailCollectionText(e.target.value)}
                        placeholder="Drop your email and we'll send it right over:"
                        rows={2}
                        maxLength={500}
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                )}
              </ToggleCard>
            </div>

            {/* ─── Section 4: And then, they will get ──────────── */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-foreground">
                And then, they will get
              </h2>

              {/* Link delivery */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">
                    a DM with a link
                  </p>
                </div>
                <div className="px-4 pb-4 flex flex-col gap-3">
                  {/* Message text */}
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <textarea
                      value={linkDmText}
                      onChange={(e) => setLinkDmText(e.target.value)}
                      placeholder="Write a message"
                      rows={3}
                      maxLength={500}
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <LinkButtonsEditor
                    links={linkButtons}
                    onChange={setLinkButtons}
                  />
                </div>
              </div>

              {/* Follow-up */}
              <ToggleCard
                label="a follow up DM if they don't click the link"
                enabled={followUpEnabled}
                onToggle={setFollowUpEnabled}
              >
                {followUpEnabled && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <textarea
                        value={followUpText}
                        onChange={(e) => setFollowUpText(e.target.value)}
                        placeholder="Just checking — did you get the link?"
                        rows={2}
                        maxLength={500}
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                    {linkButtons.length === 0 ? (
                      <InlineWarning text="Add at least one link button first. Follow-up only runs when clicks can be tracked." />
                    ) : (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Follow-up sends once, 6 hours after the link DM, only if
                        no tracked link click is recorded.
                      </p>
                    )}
                  </div>
                )}
              </ToggleCard>
            </div>

            {/* Bottom spacer for scroll */}
            <div className="h-8" />
          </div>
        </div>

        {/* Right panel: Preview */}
        <div className="w-[380px] shrink-0 border-l border-border bg-muted/30 overflow-y-auto flex items-start justify-center py-8 hidden lg:flex">
          <CommentAutomationPreview
            config={{
              commentReplyEnabled,
              commentReplyTexts,
              triggerKeywords,
              openingDmEnabled,
              openingDmText,
              openingDmButtonText,
              followGateEnabled,
              followGateText,
              emailCollectionEnabled,
              emailCollectionText,
              linkDmText,
              linkButtons,
              followUpEnabled,
              followUpText,
              validationIssues,
              username: selectedAccount.username ?? undefined,
              profilePictureUrl: selectedAccount.profilePictureUrl ?? undefined,
              selectedPostThumbnail:
                selectedMedia.length > 0
                  ? selectedMedia[0].thumbnailUrl || selectedMedia[0].mediaUrl
                  : undefined,
              selectedPostCaption:
                selectedMedia.length > 0 ? selectedMedia[0].caption : undefined,
            }}
          />
        </div>
      </div>

      {/* Post picker modal */}
      <PostPickerModal
        accountId={selectedAccount.id}
        open={showPostPicker}
        onOpenChange={setShowPostPicker}
        selectedMediaIds={selectedMediaIds}
        onSelectionChange={setSelectedMediaIds}
      />
      <OpeningDmInfoModal open={showDmInfo} onOpenChange={setShowDmInfo} />
    </main>
  );
}

// ── Reusable UI components ──────────────────────────────────────

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
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
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

function ToggleCard({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {children}
    </div>
  );
}

function ValidationIssuesNotice({
  title,
  issues,
}: {
  title: string;
  issues: string[];
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-amber-900">{title}</p>
          {issues.map((issue) => (
            <p key={issue} className="text-xs leading-relaxed text-amber-800">
              {issue}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function InlineWarning({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-xs leading-relaxed text-amber-800">{text}</p>
    </div>
  );
}
