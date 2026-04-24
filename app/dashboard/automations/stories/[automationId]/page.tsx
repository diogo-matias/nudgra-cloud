"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { AutomationDeleteDialog } from "@/components/dashboard/automation-delete-dialog";
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

export default function StoryAutomationDetailPage() {
  const params = useParams<{ automationId: string }>();
  const router = useRouter();
  const automationId = params.automationId as Id<"storyAutomations">;
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;
  const automation = useQuery(
    api.automations.storyAutomations.getStoryAutomationById,
    selectedAccount ? { accountId: selectedAccount.id, automationId } : "skip",
  );
  const options = useQuery(
    api.automations.storyAutomations.getStoryAutomationCreationOptions,
    selectedAccount ? { accountId: selectedAccount.id } : "skip",
  );
  const liveStoriesQuery = useQuery(
    api.meta.storyQueries.listCachedStories,
    selectedAccount ? { accountId: selectedAccount.id } : "skip",
  );
  const updateStoryAutomation = useMutation(
    api.automations.storyAutomations.updateStoryAutomation,
  );
  const toggleStoryAutomation = useMutation(
    api.automations.storyAutomations.toggleStoryAutomation,
  );
  const deleteStoryAutomation = useMutation(
    api.automations.storyAutomations.deleteStoryAutomation,
  );

  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState("");
  const [storyScope, setStoryScope] = useState<"any" | "specific">("any");
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedStorySnapshot, setSelectedStorySnapshot] =
    useState<SelectedStory>(null);
  const [selectedStoryExpiredAt, setSelectedStoryExpiredAt] = useState<
    number | null
  >(null);
  const [replyFilter, setReplyFilter] = useState<
    "specific_words_or_reactions" | "any_word_or_reaction"
  >("any_word_or_reaction");
  const [triggerTokens, setTriggerTokens] = useState<string[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [reactionEnabled, setReactionEnabled] = useState(false);
  const [followGateEnabled, setFollowGateEnabled] = useState(false);
  const [followGateText, setFollowGateText] = useState("");
  const [emailCollectionEnabled, setEmailCollectionEnabled] = useState(false);
  const [emailCollectionText, setEmailCollectionText] = useState("");
  const [linkDmText, setLinkDmText] = useState("");
  const [linkButtons, setLinkButtons] = useState<
    Array<{ label: string; url: string }>
  >([]);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpText, setFollowUpText] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<Id<"tags">[]>([]);
  const [showStoryPicker, setShowStoryPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!automation || initialized) {
      return;
    }

    setName(automation.name);
    setStoryScope(automation.storyScope);
    setSelectedStoryId(automation.selectedStoryId);
    setSelectedStorySnapshot(automation.selectedStory);
    setSelectedStoryExpiredAt(automation.selectedStoryExpiredAt ?? null);
    setReplyFilter(automation.replyFilter);
    setTriggerTokens(automation.triggerTokenLabels);
    setReactionEnabled(automation.reactionEnabled);
    setFollowGateEnabled(automation.followGateEnabled);
    setFollowGateText(automation.followGateText);
    setEmailCollectionEnabled(automation.emailCollectionEnabled);
    setEmailCollectionText(automation.emailCollectionText);
    setLinkDmText(automation.linkDmText);
    setLinkButtons(automation.linkButtons);
    setFollowUpEnabled(automation.followUpEnabled);
    setFollowUpText(automation.followUpText);
    setSelectedTagIds(automation.tagIds);
    setInitialized(true);
  }, [automation, initialized]);

  const selectedStory = useMemo<SelectedStory>(() => {
    if (!selectedStoryId) {
      return null;
    }

    const liveStories = liveStoriesQuery ?? [];
    const liveStory =
      liveStories.find((item) => item.storyId === selectedStoryId) ?? null;
    if (liveStory) {
      return {
        id: liveStory.storyId,
        mediaType: liveStory.mediaType,
        thumbnailUrl: liveStory.thumbnailUrl,
        mediaUrl: liveStory.mediaUrl,
        permalink: liveStory.permalink,
        timestamp: liveStory.timestamp,
      };
    }

    return selectedStorySnapshot && selectedStorySnapshot.id === selectedStoryId
      ? selectedStorySnapshot
      : null;
  }, [liveStoriesQuery, selectedStoryId, selectedStorySnapshot]);

  const normalizedTriggerTokens = getNormalizedStoryAutomationTokens(
    triggerTokens,
    tokenInput,
  );
  const validationIssues = getStoryAutomationFormValidationIssues({
    name,
    storyScope,
    selectedStoryId,
    selectedStoryExpiredAt,
    replyFilter,
    triggerTokens: normalizedTriggerTokens,
    linkDmText,
    linkButtons,
    followUpEnabled,
  });
  const canGoLive = validationIssues.length === 0;

  async function handleSave() {
    if (
      !selectedAccount ||
      !automation ||
      isSubmitting ||
      validationIssues.length > 0
    ) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const primaryLink = linkButtons[0] ?? null;
      await updateStoryAutomation({
        accountId: selectedAccount.id,
        automationId,
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
        sequenceDefinitionId: automation.sequenceDefinitionId,
      });
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Failed to update story automation.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDeleteDialogChange(open: boolean) {
    if (isDeleting) {
      return;
    }

    setShowDeleteDialog(open);
    if (!open) {
      setDeleteError(null);
    }
  }

  async function handleDelete() {
    if (!selectedAccount || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteStoryAutomation({
        accountId: selectedAccount.id,
        automationId,
      });
      router.push("/dashboard/automations");
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Failed to delete story automation.",
      );
      setIsDeleting(false);
    }
  }

  if (selectedAccount === null) {
    return (
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active Instagram account from the sidebar before opening story automation details."
        />
      </main>
    );
  }

  if (automation === undefined) {
    return (
      <main className="flex-1 px-8 py-10">
        <div className="max-w-2xl rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Loading automation...
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
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to automations
          </Link>
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Story automation not found.
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
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
                {automation.name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void toggleStoryAutomation({
                    accountId: selectedAccount.id,
                    automationId,
                    status: automation.status === "live" ? "paused" : "live",
                  })
                }
                disabled={automation.status !== "live" && !canGoLive}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
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
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteDialog(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/20 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
              >
                <Trash2 className="size-4" />
                Delete
              </button>
              <button
                type="button"
                disabled={validationIssues.length > 0 || isSubmitting}
                onClick={() => void handleSave()}
                className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>

        <StoryAutomationForm
          name={name}
          onNameChange={setName}
          storyScope={storyScope}
          onStoryScopeChange={(value) => {
            setStoryScope(value);
            if (value === "any") {
              setSelectedStoryId(null);
              setSelectedStorySnapshot(null);
              setSelectedStoryExpiredAt(null);
            }
          }}
          selectedStory={selectedStory}
          selectedStoryExpiredAt={selectedStoryExpiredAt}
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
          onSelectionChange={(storyId) => {
            setSelectedStoryId(storyId);
            const liveStories = liveStoriesQuery ?? [];
            const liveStory =
              liveStories.find((item) => item.storyId === storyId) ?? null;
            setSelectedStorySnapshot(
              liveStory
                ? {
                    id: liveStory.storyId,
                    mediaType: liveStory.mediaType,
                    thumbnailUrl: liveStory.thumbnailUrl,
                    mediaUrl: liveStory.mediaUrl,
                    permalink: liveStory.permalink,
                    timestamp: liveStory.timestamp,
                  }
                : null,
            );
            setSelectedStoryExpiredAt(null);
          }}
        />
      </main>

      <AutomationDeleteDialog
        open={showDeleteDialog}
        onOpenChange={handleDeleteDialogChange}
        automationKind="story"
        automationName={automation.name}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
