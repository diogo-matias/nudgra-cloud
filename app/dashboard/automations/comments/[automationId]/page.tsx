"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  X,
  Plus,
  HelpCircle,
  Info,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Switch } from "@/components/ui/switch";
import { PostPickerModal } from "@/components/dashboard/post-picker-modal";
import { CommentAutomationPreview } from "@/components/dashboard/comment-automation-preview";
import { OpeningDmInfoModal } from "@/components/dashboard/opening-dm-info-modal";

type PostScope = "specific" | "any" | "next";
type CommentFilter = "specific_words" | "any_word";

export default function CommentAutomationDetailPage() {
  const params = useParams<{ automationId: string }>();
  const router = useRouter();
  const automationId = params.automationId as Id<"commentAutomations">;

  const automation = useQuery(
    api.automations.commentAutomations.getCommentAutomationById,
    { automationId },
  );
  const accountStatus = useQuery(api.accounts.getCurrentAccountStatus);
  const media = useQuery(api.meta.mediaQueries.listCachedMedia) ?? [];
  const updateAutomation = useMutation(
    api.automations.commentAutomations.updateCommentAutomation,
  );
  const toggleAutomation = useMutation(
    api.automations.commentAutomations.toggleCommentAutomation,
  );

  // Form state
  const [name, setName] = useState("");
  const [postScope, setPostScope] = useState<PostScope>("specific");
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [showPostPicker, setShowPostPicker] = useState(false);
  const [showDmInfo, setShowDmInfo] = useState(false);
  const [commentFilter, setCommentFilter] =
    useState<CommentFilter>("specific_words");
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [commentReplyEnabled, setCommentReplyEnabled] = useState(true);
  const [commentReplyTexts, setCommentReplyTexts] = useState<string[]>([""]);
  const [openingDmEnabled, setOpeningDmEnabled] = useState(true);
  const [openingDmText, setOpeningDmText] = useState("");
  const [openingDmButtonText, setOpeningDmButtonText] = useState("");
  const [followGateEnabled, setFollowGateEnabled] = useState(false);
  const [followGateText, setFollowGateText] = useState("");
  const [emailCollectionEnabled, setEmailCollectionEnabled] = useState(false);
  const [emailCollectionText, setEmailCollectionText] = useState("");
  const [linkDmText, setLinkDmText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpText, setFollowUpText] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Get selected media items for thumbnail previews
  const selectedMedia = media.filter((m) =>
    selectedMediaIds.includes(m.mediaId),
  );

  // Populate form when automation loads
  useEffect(() => {
    if (automation && !initialized) {
      setName(automation.name);
      setPostScope(automation.postScope);
      setSelectedMediaIds(automation.selectedMediaIds);
      setCommentFilter(automation.commentFilter);
      setTriggerKeywords(automation.triggerKeywords);
      setCommentReplyEnabled(automation.commentReplyEnabled);
      setCommentReplyTexts(
        automation.commentReplyTexts.length > 0
          ? automation.commentReplyTexts
          : [""],
      );
      setOpeningDmEnabled(automation.openingDmEnabled);
      setOpeningDmText(automation.openingDmText);
      setOpeningDmButtonText(automation.openingDmButtonText);
      setFollowGateEnabled(automation.followGateEnabled);
      setFollowGateText(automation.followGateText);
      setEmailCollectionEnabled(automation.emailCollectionEnabled);
      setEmailCollectionText(automation.emailCollectionText);
      setLinkDmText(automation.linkDmText);
      setLinkUrl(automation.linkUrl);
      setFollowUpEnabled(automation.followUpEnabled);
      setFollowUpText(automation.followUpText);
      setInitialized(true);
    }
  }, [automation, initialized]);

  function addKeyword() {
    const trimmed = keywordInput.trim().toLowerCase();
    if (trimmed && !triggerKeywords.includes(trimmed)) {
      setTriggerKeywords((prev) => [...prev, trimmed]);
    }
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
    const lower = keyword.toLowerCase();
    if (!triggerKeywords.includes(lower)) {
      setTriggerKeywords((prev) => [...prev, lower]);
    }
  }

  const isValid =
    name.trim().length > 0 &&
    (postScope !== "specific" || selectedMediaIds.length > 0) &&
    (commentFilter !== "specific_words" || triggerKeywords.length > 0) &&
    (linkDmText.trim().length > 0 || linkUrl.trim().length > 0);

  async function handleSave() {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await updateAutomation({
        automationId,
        name,
        postScope,
        selectedMediaIds,
        commentFilter,
        triggerKeywords,
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
        linkUrl,
        followUpEnabled,
        followUpText,
      });

      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update automation:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancelEdit() {
    if (automation) {
      setName(automation.name);
      setPostScope(automation.postScope);
      setSelectedMediaIds(automation.selectedMediaIds);
      setCommentFilter(automation.commentFilter);
      setTriggerKeywords(automation.triggerKeywords);
      setCommentReplyEnabled(automation.commentReplyEnabled);
      setCommentReplyTexts(
        automation.commentReplyTexts.length > 0
          ? automation.commentReplyTexts
          : [""],
      );
      setOpeningDmEnabled(automation.openingDmEnabled);
      setOpeningDmText(automation.openingDmText);
      setOpeningDmButtonText(automation.openingDmButtonText);
      setFollowGateEnabled(automation.followGateEnabled);
      setFollowGateText(automation.followGateText);
      setEmailCollectionEnabled(automation.emailCollectionEnabled);
      setEmailCollectionText(automation.emailCollectionText);
      setLinkDmText(automation.linkDmText);
      setLinkUrl(automation.linkUrl);
      setFollowUpEnabled(automation.followUpEnabled);
      setFollowUpText(automation.followUpText);
    }
    setIsEditing(false);
  }

  // Loading / not found
  if (automation === undefined) {
    return (
      <main className="flex-1 px-8 py-10">
        <div className="max-w-2xl">
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Loading automation...
          </div>
        </div>
      </main>
    );
  }

  if (automation === null) {
    return (
      <main className="flex-1 px-8 py-10">
        <div className="max-w-2xl flex flex-col gap-4">
          <Link
            href="/dashboard/automations"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="size-3.5" />
            Back to automations
          </Link>
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Automation not found.
          </div>
        </div>
      </main>
    );
  }

  // Get automation's selected media for read-only view thumbnails
  const automationSelectedMedia = media.filter((m) =>
    automation.selectedMediaIds.includes(m.mediaId),
  );

  // ── Read-only view ──────────────────────────────────────────────
  if (!isEditing) {
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
                {automation.name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void toggleAutomation({
                    automationId,
                    status: automation.status === "live" ? "paused" : "live",
                  })
                }
                className="inline-flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                {automation.status === "live" ? (
                  <ToggleRight className="size-5 text-primary" />
                ) : (
                  <ToggleLeft className="size-5" />
                )}
                {automation.status === "live" ? "Pause" : "Go live"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: Details */}
          <div className="flex-1 overflow-y-auto px-8 py-8">
            <div className="max-w-xl flex flex-col gap-5">
              {/* Status + stats */}
              <div className="bg-card border border-border rounded-xl p-5 flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-foreground">
                      {automation.name}
                    </h1>
                    <StatusBadge status={automation.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Triggered {automation.triggerCount} time
                    {automation.triggerCount === 1 ? "" : "s"}
                    {automation.lastTriggeredAt
                      ? ` · Last: ${new Date(automation.lastTriggeredAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
              </div>

              {/* Trigger */}
              <DetailCard title="Trigger">
                <DetailRow
                  label="Posts"
                  value={
                    automation.postScope === "specific"
                      ? `${automation.selectedMediaIds.length} specific post${automation.selectedMediaIds.length !== 1 ? "s" : ""}`
                      : automation.postScope === "any"
                        ? "All posts and reels"
                        : "Next post only"
                  }
                />
                {/* Show thumbnails of selected posts */}
                {automation.postScope === "specific" &&
                  automationSelectedMedia.length > 0 && (
                    <div className="flex gap-2">
                      {automationSelectedMedia.slice(0, 4).map((item) => {
                        const imageUrl = item.thumbnailUrl || item.mediaUrl;
                        return (
                          <div
                            key={item.mediaId}
                            className="relative size-14 rounded-lg overflow-hidden border border-border"
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
                          </div>
                        );
                      })}
                      {automationSelectedMedia.length > 4 && (
                        <div className="size-14 rounded-lg bg-muted border border-border flex items-center justify-center">
                          <span className="text-xs text-muted-foreground font-medium">
                            +{automationSelectedMedia.length - 4}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                <DetailRow
                  label="Comment filter"
                  value={
                    automation.commentFilter === "specific_words"
                      ? "Specific keywords"
                      : "Any comment"
                  }
                />
                {automation.triggerKeywords.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Keywords
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {automation.triggerKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="text-xs font-mono text-foreground bg-muted border border-border rounded-md px-2 py-0.5"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </DetailCard>

              {/* Comment reply */}
              {automation.commentReplyEnabled && (
                <DetailCard title="Comment reply">
                  {automation.commentReplyTexts.map((text, i) => (
                    <p
                      key={i}
                      className="text-sm text-foreground leading-relaxed"
                    >
                      {text}
                    </p>
                  ))}
                </DetailCard>
              )}

              {/* Opening DM */}
              {automation.openingDmEnabled && (
                <DetailCard title="Opening DM">
                  <DetailRow label="Message" value={automation.openingDmText} />
                  <DetailRow
                    label="Button"
                    value={automation.openingDmButtonText}
                  />
                </DetailCard>
              )}

              {/* Follow gate */}
              {automation.followGateEnabled && (
                <DetailCard title="Follow gate">
                  <DetailRow
                    label="Message"
                    value={automation.followGateText}
                  />
                </DetailCard>
              )}

              {/* Email collection */}
              {automation.emailCollectionEnabled && (
                <DetailCard title="Email collection">
                  <DetailRow
                    label="Message"
                    value={automation.emailCollectionText}
                  />
                </DetailCard>
              )}

              {/* Link delivery */}
              <DetailCard title="Link delivery">
                <DetailRow label="Message" value={automation.linkDmText} />
                <DetailRow label="URL" value={automation.linkUrl} />
              </DetailCard>

              {/* Follow-up */}
              {automation.followUpEnabled && (
                <DetailCard title="Follow-up">
                  <DetailRow label="Message" value={automation.followUpText} />
                </DetailCard>
              )}
            </div>
          </div>

          {/* Right: Preview */}
          <div className="w-[380px] shrink-0 border-l border-border bg-muted/30 overflow-y-auto flex items-start justify-center py-8 hidden lg:flex">
            <CommentAutomationPreview
              config={{
                commentReplyEnabled: automation.commentReplyEnabled,
                commentReplyTexts: automation.commentReplyTexts,
                triggerKeywords: automation.triggerKeywords,
                openingDmEnabled: automation.openingDmEnabled,
                openingDmText: automation.openingDmText,
                openingDmButtonText: automation.openingDmButtonText,
                followGateEnabled: automation.followGateEnabled,
                followGateText: automation.followGateText,
                emailCollectionEnabled: automation.emailCollectionEnabled,
                emailCollectionText: automation.emailCollectionText,
                linkDmText: automation.linkDmText,
                linkUrl: automation.linkUrl,
                username: accountStatus?.account?.username ?? undefined,
                profilePictureUrl:
                  accountStatus?.account?.profilePictureUrl ?? undefined,
                selectedPostThumbnail:
                  automationSelectedMedia.length > 0
                    ? automationSelectedMedia[0].thumbnailUrl ||
                      automationSelectedMedia[0].mediaUrl
                    : undefined,
                selectedPostCaption:
                  automationSelectedMedia.length > 0
                    ? automationSelectedMedia[0].caption
                    : undefined,
              }}
            />
          </div>
        </div>
      </main>
    );
  }

  // ── Edit view ───────────────────────────────────────────────────
  return (
    <main className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="border-b border-border bg-background px-8 py-4 shrink-0">
        <div className="flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              Cancel editing
            </button>
            <span className="text-border">/</span>
            <span className="text-sm font-medium text-foreground">
              Editing: {automation.name}
            </span>
          </div>

          <button
            type="button"
            disabled={!isValid || isSubmitting}
            onClick={() => void handleSave()}
            className="inline-flex items-center bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left panel: Form */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
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

                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
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
                  <div className="mt-3">
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

                  {linkUrl ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://example.com/your-link"
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setLinkUrl("")}
                        className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLinkUrl("https://")}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Plus className="size-4" />
                      Add A Link
                    </button>
                  )}
                </div>
              </div>

              {/* Follow-up */}
              <ToggleCard
                label="a follow up DM if they don't click the link"
                enabled={followUpEnabled}
                onToggle={setFollowUpEnabled}
              >
                {followUpEnabled && (
                  <div className="mt-3">
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
                  </div>
                )}
              </ToggleCard>
            </div>

            <div className="h-8" />
          </div>
        </div>

        {/* Right: Preview */}
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
              linkUrl,
              username: accountStatus?.account?.username ?? undefined,
              profilePictureUrl:
                accountStatus?.account?.profilePictureUrl ?? undefined,
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

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "live"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : status === "paused"
        ? "text-muted-foreground bg-muted border-border"
        : "text-amber-700 bg-amber-50 border-amber-200";

  const label =
    status === "live" ? "Live" : status === "paused" ? "Paused" : "Draft";

  return (
    <span
      className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border ${styles}`}
    >
      {label}
    </span>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground leading-relaxed">{value || "—"}</p>
    </div>
  );
}
