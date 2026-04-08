"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";
import {
  ArrowLeft,
  X,
  Plus,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { PostPickerModal } from "@/components/dashboard/post-picker-modal";
import { CommentAutomationPreview } from "@/components/dashboard/comment-automation-preview";

type PostScope = "specific" | "any" | "next";
type CommentFilter = "specific_words" | "any_word";

export default function NewCommentAutomationPage() {
  const router = useRouter();
  const createAutomation = useMutation(
    api.automations.commentAutomations.createCommentAutomation,
  );

  // General
  const [name, setName] = useState("");

  // Post selection
  const [postScope, setPostScope] = useState<PostScope>("specific");
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [showPostPicker, setShowPostPicker] = useState(false);

  // Comment filter
  const [commentFilter, setCommentFilter] =
    useState<CommentFilter>("specific_words");
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  // Comment reply
  const [commentReplyEnabled, setCommentReplyEnabled] = useState(true);
  const [commentReplyTexts, setCommentReplyTexts] = useState<string[]>([
    "Thanks! Check your DMs 📩",
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
  const [linkUrl, setLinkUrl] = useState("");

  // Follow-up
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpText, setFollowUpText] = useState(
    "Just checking — did you get the link? Let me know if you need anything!",
  );

  // Collapsible sections
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

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleSubmit(goLive: boolean) {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const result = await createAutomation({
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
        goLive,
      });

      router.push(`/dashboard/automations/comments/${result.automationId}`);
    } catch (error) {
      console.error("Failed to create automation:", error);
      setIsSubmitting(false);
    }
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

            {/* ─── Trigger Section ─────────────────────────────── */}
            <CollapsibleSection
              title="Trigger"
              subtitle="Which posts and comments activate this automation"
              expanded={expandedSections.trigger}
              onToggle={() => toggleSection("trigger")}
            >
              {/* Post scope */}
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

                {/* Post picker button */}
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

              {/* Comment filter */}
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

                {/* Keyword input */}
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

            {/* ─── Comment Reply Section ───────────────────────── */}
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
                  <p className="text-xs text-muted-foreground">
                    If you add multiple replies, one will be picked at random
                    each time.
                  </p>
                </div>
              )}
            </CollapsibleSection>

            {/* ─── Opening DM Section ─────────────────────────── */}
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

            {/* ─── Follow Gate Section ────────────────────────── */}
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

            {/* ─── Email Collection Section ───────────────────── */}
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

            {/* ─── Link Delivery Section ──────────────────────── */}
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

            {/* ─── Follow-up Section ──────────────────────────── */}
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
