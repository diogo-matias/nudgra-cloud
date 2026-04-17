"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { StoryAutomationForm } from "@/components/dashboard/story-automation-form";
import { StoryPickerModal } from "@/components/dashboard/story-picker-modal";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";
import {
  getNormalizedStoryAutomationTokens,
  getStoryAutomationFormValidationIssues,
} from "@/lib/story-automation-ui";

type SelectedStory = {
  id: string;
  mediaType: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
} | null;

export default function NewStoryAutomationPage() {
  const router = useRouter();
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;
  const options = useQuery(
    api.automations.storyAutomations.getStoryAutomationCreationOptions,
    selectedAccount ? { accountId: selectedAccount.id } : "skip",
  );
  const liveStoriesQuery = useQuery(
    api.meta.storyQueries.listCachedStories,
    selectedAccount ? { accountId: selectedAccount.id } : "skip",
  );
  const createStoryAutomation = useMutation(
    api.automations.storyAutomations.createStoryAutomation,
  );

  const [name, setName] = useState("");
  const [storyScope, setStoryScope] = useState<"any" | "specific">("any");
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [replyFilter, setReplyFilter] = useState<
    "specific_words_or_reactions" | "any_word_or_reaction"
  >("any_word_or_reaction");
  const [triggerTokens, setTriggerTokens] = useState<string[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [reactionEnabled, setReactionEnabled] = useState(false);
  const [followGateEnabled, setFollowGateEnabled] = useState(false);
  const [followGateText, setFollowGateText] = useState(
    `Nearly there! The link is especially for my followers ✨

Right after you follow me, I'll send you the link so you can dive straight in! 🎉`,
  );
  const [emailCollectionEnabled, setEmailCollectionEnabled] = useState(false);
  const [emailCollectionText, setEmailCollectionText] = useState(
    "Drop your email and we'll send it right over:",
  );
  const [linkDmText, setLinkDmText] = useState("Here's your link:");
  const [linkButtons, setLinkButtons] = useState<
    Array<{ label: string; url: string }>
  >([]);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpText, setFollowUpText] = useState(
    "Just checking in - did you get the link?",
  );
  const [selectedTagIds, setSelectedTagIds] = useState<Id<"tags">[]>([]);
  const [showStoryPicker, setShowStoryPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const selectedStory = useMemo<SelectedStory>(() => {
    if (!selectedStoryId) {
      return null;
    }

    const liveStories = liveStoriesQuery ?? [];
    const story =
      liveStories.find((item) => item.storyId === selectedStoryId) ?? null;
    if (story === null) {
      return null;
    }

    return {
      id: story.storyId,
      mediaType: story.mediaType,
      thumbnailUrl: story.thumbnailUrl,
      mediaUrl: story.mediaUrl,
      permalink: story.permalink,
      timestamp: story.timestamp,
    };
  }, [liveStoriesQuery, selectedStoryId]);

  const normalizedTriggerTokens = getNormalizedStoryAutomationTokens(
    triggerTokens,
    tokenInput,
  );
  const validationIssues = getStoryAutomationFormValidationIssues({
    name,
    storyScope,
    selectedStoryId,
    selectedStoryExpiredAt: null,
    replyFilter,
    triggerTokens: normalizedTriggerTokens,
    linkDmText,
    linkButtons,
    followUpEnabled,
  });
  const isValid =
    validationIssues.length === 0 && Boolean(options?.hasConnectedAccount);

  async function handleSubmit(goLive: boolean) {
    if (!selectedAccount || !isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const primaryLink = linkButtons[0] ?? null;
      const result = await createStoryAutomation({
        accountId: selectedAccount.id,
        name,
        storyScope,
        selectedStoryId: selectedStoryId ?? "",
        replyFilter,
        triggerTokens: normalizedTriggerTokens,
        triggerTokenLabels: triggerTokens,
        reactionEnabled,
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
        tagIds: selectedTagIds,
        sequenceDefinitionId: null,
        goLive,
      });

      router.push(`/dashboard/automations/stories/${result.automationId}`);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Failed to create story automation.",
      );
      setIsSubmitting(false);
    }
  }

  if (selectedAccount === null) {
    return (
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active Instagram account from the sidebar before creating a story automation."
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-background px-8 py-4">
        <div className="flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/automations"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Automations
            </Link>
            <span className="text-border">/</span>
            <span className="text-sm font-medium text-foreground">
              Generate leads with stories
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isValid || isSubmitting}
              onClick={() => void handleSubmit(false)}
              className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "Saving..." : "Save as draft"}
            </button>
            <button
              type="button"
              disabled={!isValid || isSubmitting}
              onClick={() => void handleSubmit(true)}
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "Saving..." : "Go Live"}
            </button>
          </div>
        </div>
      </div>

      {!options?.hasConnectedAccount ? (
        <div className="border-b border-amber-200 bg-amber-50 px-8 py-3 text-sm text-amber-900">
          Connect an Instagram account before creating story automations.
        </div>
      ) : null}

      <StoryAutomationForm
        name={name}
        onNameChange={setName}
        storyScope={storyScope}
        onStoryScopeChange={(value) => {
          setStoryScope(value);
          if (value === "any") {
            setSelectedStoryId(null);
          }
        }}
        selectedStory={selectedStory}
        selectedStoryExpiredAt={null}
        onPickStory={() => setShowStoryPicker(true)}
        replyFilter={replyFilter}
        onReplyFilterChange={setReplyFilter}
        triggerTokens={triggerTokens}
        tokenInput={tokenInput}
        onTokenInputChange={setTokenInput}
        onTriggerTokensChange={setTriggerTokens}
        reactionEnabled={reactionEnabled}
        onReactionEnabledChange={setReactionEnabled}
        followGateEnabled={followGateEnabled}
        onFollowGateEnabledChange={setFollowGateEnabled}
        followGateText={followGateText}
        onFollowGateTextChange={setFollowGateText}
        emailCollectionEnabled={emailCollectionEnabled}
        onEmailCollectionEnabledChange={setEmailCollectionEnabled}
        emailCollectionText={emailCollectionText}
        onEmailCollectionTextChange={setEmailCollectionText}
        linkDmText={linkDmText}
        onLinkDmTextChange={setLinkDmText}
        linkButtons={linkButtons}
        onLinkButtonsChange={setLinkButtons}
        followUpEnabled={followUpEnabled}
        onFollowUpEnabledChange={setFollowUpEnabled}
        followUpText={followUpText}
        onFollowUpTextChange={setFollowUpText}
        tagOptions={options?.tags ?? []}
        selectedTagIds={selectedTagIds}
        onSelectedTagIdsChange={setSelectedTagIds}
        showStatusToggle={false}
        validationIssues={validationIssues}
        submissionError={submissionError}
        username={selectedAccount.username}
        profilePictureUrl={selectedAccount.profilePictureUrl}
      />

      <StoryPickerModal
        accountId={selectedAccount.id}
        open={showStoryPicker}
        onOpenChange={setShowStoryPicker}
        selectedStoryId={selectedStoryId}
        onSelectionChange={(storyId) => setSelectedStoryId(storyId)}
      />
    </main>
  );
}
