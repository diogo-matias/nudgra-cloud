"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  X,
  Plus,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Switch } from "@/components/ui/switch";
import { PostPickerModal } from "@/components/dashboard/post-picker-modal";
import { CommentAutomationPreview } from "@/components/dashboard/comment-automation-preview";

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

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    trigger: true,
    commentReply: true,
    openingDm: true,
    followGate: false,
    emailCollection: false,
    linkDelivery: true,
    followUp: false,
  });

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
      setExpandedSections({
        trigger: true,
        commentReply: automation.commentReplyEnabled,
        openingDm: automation.openingDmEnabled,
        followGate: automation.followGateEnabled,
        emailCollection: automation.emailCollectionEnabled,
        linkDelivery: true,
        followUp: automation.followUpEnabled,
      });
      setInitialized(true);
    }
  }, [automation, initialized]);

  function toggleSection(section: string) {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

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
          <div className="max-w-xl flex flex-col gap-6">
            {/* Automation name */}
            <FormField label="Automation name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Free guide link"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
              />
            </FormField>

            {/* Trigger */}
            <CollapsibleSection
              title="Trigger"
              subtitle="Which posts and comments activate this automation"
              expanded={expandedSections.trigger}
              onToggle={() => toggleSection("trigger")}
            >
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-foreground">
                  Apply to posts
                </p>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      {
                        value: "specific" as PostScope,
                        label: "Specific posts or reels",
                        desc: "Choose which posts to monitor",
                      },
                      {
                        value: "any" as PostScope,
                        label: "All posts and reels",
                        desc: "Monitor every post on your account",
                      },
                      {
                        value: "next" as PostScope,
                        label: "Next post only",
                        desc: "Automatically apply to your next published post",
                      },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        postScope === option.value
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="postScope"
                        value={option.value}
                        checked={postScope === option.value}
                        onChange={() => setPostScope(option.value)}
                        className="mt-0.5 accent-primary shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {option.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {option.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {postScope === "specific" && (
                  <button
                    type="button"
                    onClick={() => setShowPostPicker(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/[0.02] transition-all cursor-pointer"
                  >
                    <ImageIcon className="size-4" />
                    {selectedMediaIds.length === 0
                      ? "Select posts or reels"
                      : `${selectedMediaIds.length} post${selectedMediaIds.length !== 1 ? "s" : ""} selected`}
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3 mt-5">
                <p className="text-sm font-medium text-foreground">
                  Trigger on comments
                </p>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      {
                        value: "specific_words" as CommentFilter,
                        label: "Containing specific keywords",
                        desc: "Only trigger when the comment includes one of your keywords",
                      },
                      {
                        value: "any_word" as CommentFilter,
                        label: "Any comment",
                        desc: "Trigger on every comment on the selected posts",
                      },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        commentFilter === option.value
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="commentFilter"
                        value={option.value}
                        checked={commentFilter === option.value}
                        onChange={() => setCommentFilter(option.value)}
                        className="mt-0.5 accent-primary shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {option.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {option.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {commentFilter === "specific_words" && (
                  <div className="flex flex-col gap-2 mt-1">
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
                              onClick={() => removeKeyword(keyword)}
                              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
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
                    <p className="text-xs text-muted-foreground">
                      Case-insensitive. Press Enter or comma to add.
                    </p>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* Comment reply */}
            <CollapsibleSection
              title="Comment reply"
              subtitle="Automatically reply under the triggering comment"
              expanded={expandedSections.commentReply}
              onToggle={() => toggleSection("commentReply")}
              toggle={
                <Switch
                  checked={commentReplyEnabled}
                  onCheckedChange={setCommentReplyEnabled}
                />
              }
            >
              {commentReplyEnabled && (
                <div className="flex flex-col gap-3">
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
            </CollapsibleSection>

            {/* Opening DM */}
            <CollapsibleSection
              title="Opening DM"
              subtitle="The first DM sent when the automation triggers"
              expanded={expandedSections.openingDm}
              onToggle={() => toggleSection("openingDm")}
              toggle={
                <Switch
                  checked={openingDmEnabled}
                  onCheckedChange={setOpeningDmEnabled}
                />
              }
            >
              {openingDmEnabled && (
                <div className="flex flex-col gap-4">
                  <FormField label="Message text">
                    <textarea
                      value={openingDmText}
                      onChange={(e) => setOpeningDmText(e.target.value)}
                      placeholder="Hey! Thanks for your interest..."
                      rows={3}
                      maxLength={500}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition resize-none"
                    />
                  </FormField>
                  <FormField
                    label="Button text"
                    hint="The user taps this button to continue the flow"
                  >
                    <input
                      type="text"
                      value={openingDmButtonText}
                      onChange={(e) => setOpeningDmButtonText(e.target.value)}
                      placeholder="Send me the link"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
                    />
                  </FormField>
                </div>
              )}
            </CollapsibleSection>

            {/* Follow gate */}
            <CollapsibleSection
              title="Follow gate"
              subtitle="Require the user to follow before receiving the link"
              expanded={expandedSections.followGate}
              onToggle={() => toggleSection("followGate")}
              toggle={
                <Switch
                  checked={followGateEnabled}
                  onCheckedChange={setFollowGateEnabled}
                />
              }
            >
              {followGateEnabled && (
                <FormField label="Gate message">
                  <textarea
                    value={followGateText}
                    onChange={(e) => setFollowGateText(e.target.value)}
                    placeholder="Please follow our account to get the link!"
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition resize-none"
                  />
                </FormField>
              )}
            </CollapsibleSection>

            {/* Email collection */}
            <CollapsibleSection
              title="Email collection"
              subtitle="Ask for the user's email before sending the link"
              expanded={expandedSections.emailCollection}
              onToggle={() => toggleSection("emailCollection")}
              toggle={
                <Switch
                  checked={emailCollectionEnabled}
                  onCheckedChange={setEmailCollectionEnabled}
                />
              }
            >
              {emailCollectionEnabled && (
                <FormField label="Email request message">
                  <textarea
                    value={emailCollectionText}
                    onChange={(e) => setEmailCollectionText(e.target.value)}
                    placeholder="Drop your email and we'll send it right over:"
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition resize-none"
                  />
                </FormField>
              )}
            </CollapsibleSection>

            {/* Link delivery */}
            <CollapsibleSection
              title="Link delivery"
              subtitle="The final DM with the link"
              expanded={expandedSections.linkDelivery}
              onToggle={() => toggleSection("linkDelivery")}
            >
              <div className="flex flex-col gap-4">
                <FormField label="Message text">
                  <textarea
                    value={linkDmText}
                    onChange={(e) => setLinkDmText(e.target.value)}
                    placeholder="Here's your link:"
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition resize-none"
                  />
                </FormField>
                <FormField label="Link URL">
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com/your-link"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
                  />
                </FormField>
              </div>
            </CollapsibleSection>

            {/* Follow-up */}
            <CollapsibleSection
              title="Follow-up"
              subtitle="Send a reminder if the user doesn't click"
              expanded={expandedSections.followUp}
              onToggle={() => toggleSection("followUp")}
              toggle={
                <Switch
                  checked={followUpEnabled}
                  onCheckedChange={setFollowUpEnabled}
                />
              }
            >
              {followUpEnabled && (
                <FormField label="Follow-up message">
                  <textarea
                    value={followUpText}
                    onChange={(e) => setFollowUpText(e.target.value)}
                    placeholder="Just checking — did you get the link?"
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition resize-none"
                  />
                </FormField>
              )}
            </CollapsibleSection>

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
    </main>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

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
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  expanded,
  onToggle,
  toggle,
  children,
}: {
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  toggle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full px-5 py-4 text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {toggle && (
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.stopPropagation();
              }}
            >
              {toggle}
            </div>
          )}
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && <div className="px-5 pb-5">{children}</div>}
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
