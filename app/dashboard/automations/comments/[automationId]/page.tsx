"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CommentAutomationDetail } from "@/components/dashboard/comment-automation-detail";
import { CommentAutomationForm } from "@/components/dashboard/comment-automation-form";
import { OpeningDmInfoModal } from "@/components/dashboard/opening-dm-info-modal";
import { PostPickerModal } from "@/components/dashboard/post-picker-modal";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";
import {
  buildCommentAutomationMutationValues,
  createCommentAutomationFormValues,
  createDefaultCommentAutomationFormValues,
  getCommentAutomationFormValidationIssues,
  mergeCommentAutomationKeywords,
} from "@/lib/comment-automation-ui";

export default function CommentAutomationDetailPage() {
  const params = useParams<{ automationId: string }>();
  const automationId = params.automationId as Id<"commentAutomations">;
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;

  const automation = useQuery(
    api.automations.commentAutomations.getCommentAutomationById,
    selectedAccount ? { accountId: selectedAccount.id, automationId } : "skip",
  );
  const media =
    useQuery(
      api.meta.mediaQueries.listCachedMedia,
      selectedAccount ? { accountId: selectedAccount.id } : "skip",
    ) ?? [];
  const updateAutomation = useMutation(
    api.automations.commentAutomations.updateCommentAutomation,
  );
  const toggleAutomation = useMutation(
    api.automations.commentAutomations.toggleCommentAutomation,
  );

  const [formValues, setFormValues] = useState(() =>
    createDefaultCommentAutomationFormValues(),
  );
  const [keywordInput, setKeywordInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showPostPicker, setShowPostPicker] = useState(false);
  const [showDmInfo, setShowDmInfo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!automation || isEditing) {
      return;
    }

    setFormValues(
      createCommentAutomationFormValues({
        name: automation.name,
        postScope: automation.postScope,
        selectedMediaIds: automation.selectedMediaIds,
        commentFilter: automation.commentFilter,
        triggerKeywords: automation.triggerKeywordLabels,
        commentReplyEnabled: automation.commentReplyEnabled,
        commentReplyTexts: automation.commentReplyTexts,
        openingDmEnabled: automation.openingDmEnabled,
        openingDmText: automation.openingDmText,
        openingDmButtonText: automation.openingDmButtonText,
        followGateEnabled: automation.followGateEnabled,
        followGateText: automation.followGateText,
        emailCollectionEnabled: automation.emailCollectionEnabled,
        emailCollectionText: automation.emailCollectionText,
        linkDmText: automation.linkDmText,
        linkButtons: automation.linkButtons,
        followUpEnabled: automation.followUpEnabled,
        followUpText: automation.followUpText,
      }),
    );
    setKeywordInput("");
  }, [automation, isEditing]);

  const validationIssues = useMemo(
    () =>
      getCommentAutomationFormValidationIssues({
        name: formValues.name,
        postScope: formValues.postScope,
        selectedMediaIds: formValues.selectedMediaIds,
        commentFilter: formValues.commentFilter,
        triggerKeywords: mergeCommentAutomationKeywords(
          formValues.triggerKeywords,
          keywordInput,
        ),
        followGateEnabled: formValues.followGateEnabled,
        linkDmText: formValues.linkDmText,
        linkButtons: formValues.linkButtons,
        followUpEnabled: formValues.followUpEnabled,
      }),
    [formValues, keywordInput],
  );
  const canSave = validationIssues.length === 0;

  function resetFormFromAutomation() {
    if (!automation) {
      return;
    }

    setFormValues(
      createCommentAutomationFormValues({
        name: automation.name,
        postScope: automation.postScope,
        selectedMediaIds: automation.selectedMediaIds,
        commentFilter: automation.commentFilter,
        triggerKeywords: automation.triggerKeywordLabels,
        commentReplyEnabled: automation.commentReplyEnabled,
        commentReplyTexts: automation.commentReplyTexts,
        openingDmEnabled: automation.openingDmEnabled,
        openingDmText: automation.openingDmText,
        openingDmButtonText: automation.openingDmButtonText,
        followGateEnabled: automation.followGateEnabled,
        followGateText: automation.followGateText,
        emailCollectionEnabled: automation.emailCollectionEnabled,
        emailCollectionText: automation.emailCollectionText,
        linkDmText: automation.linkDmText,
        linkButtons: automation.linkButtons,
        followUpEnabled: automation.followUpEnabled,
        followUpText: automation.followUpText,
      }),
    );
    setKeywordInput("");
  }

  async function handleSave() {
    if (!selectedAccount || !automation || !canSave || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      await updateAutomation({
        accountId: selectedAccount.id,
        automationId,
        ...buildCommentAutomationMutationValues(formValues, keywordInput),
      });

      setIsEditing(false);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Failed to update automation.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (selectedAccount === null) {
    return (
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active Instagram account from the sidebar before opening comment automation details."
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
        <div className="flex max-w-2xl flex-col gap-4">
          <Link
            href="/dashboard/automations"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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

  if (!isEditing) {
    const canGoLive = automation.validationIssues.length === 0;
    const nextToggleStatus = automation.status === "live" ? "paused" : "live";

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
                {automation.name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={nextToggleStatus === "live" && !canGoLive}
                title={
                  nextToggleStatus === "live" && !canGoLive
                    ? automation.validationIssues[0] ??
                      "Automation must be fixed before going live."
                    : undefined
                }
                onClick={() =>
                  void toggleAutomation({
                    accountId: selectedAccount.id,
                    automationId,
                    status: nextToggleStatus,
                  })
                }
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
                  resetFormFromAutomation();
                  setSubmissionError(null);
                  setIsEditing(true);
                }}
                className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Edit
              </button>
            </div>
          </div>
        </div>

        <CommentAutomationDetail
          automation={automation}
          media={media}
          username={selectedAccount.username}
          profilePictureUrl={selectedAccount.profilePictureUrl}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-background px-8 py-4">
        <div className="flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                resetFormFromAutomation();
                setSubmissionError(null);
                setIsEditing(false);
              }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
            disabled={!canSave || isSubmitting}
            title={
              !canSave
                ? validationIssues[0] ?? "Fix the validation issues first."
                : undefined
            }
            onClick={() => void handleSave()}
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      <CommentAutomationForm
        values={formValues}
        onValuesChange={setFormValues}
        keywordInput={keywordInput}
        onKeywordInputChange={setKeywordInput}
        media={media}
        validationIssues={validationIssues}
        submissionError={submissionError}
        username={selectedAccount.username}
        profilePictureUrl={selectedAccount.profilePictureUrl}
        onPickPosts={() => setShowPostPicker(true)}
        onShowOpeningDmInfo={() => setShowDmInfo(true)}
      />

      <PostPickerModal
        accountId={selectedAccount.id}
        open={showPostPicker}
        onOpenChange={setShowPostPicker}
        selectedMediaIds={formValues.selectedMediaIds}
        onSelectionChange={(selectedMediaIds) =>
          setFormValues((current) => ({ ...current, selectedMediaIds }))
        }
      />
      <OpeningDmInfoModal open={showDmInfo} onOpenChange={setShowDmInfo} />
    </main>
  );
}
