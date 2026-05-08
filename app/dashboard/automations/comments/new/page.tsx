"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { CommentAutomationForm } from "@/components/dashboard/comment-automation-form";
import { OpeningDmInfoModal } from "@/components/dashboard/opening-dm-info-modal";
import { PostPickerModal } from "@/components/dashboard/post-picker-modal";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";
import {
  buildCommentAutomationMutationValues,
  createDefaultCommentAutomationFormValues,
  getCommentAutomationFormValidationIssues,
  mergeCommentAutomationKeywords,
} from "@/lib/comment-automation-ui";

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

  const [formValues, setFormValues] = useState(() =>
    createDefaultCommentAutomationFormValues(),
  );
  const [keywordInput, setKeywordInput] = useState("");
  const [showPostPicker, setShowPostPicker] = useState(false);
  const [showDmInfo, setShowDmInfo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

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
        openingDmEnabled: formValues.openingDmEnabled,
        openingDmText: formValues.openingDmText,
        followGateEnabled: formValues.followGateEnabled,
        emailCollectionEnabled: formValues.emailCollectionEnabled,
        emailCollectionText: formValues.emailCollectionText,
        linkDmText: formValues.linkDmText,
        linkButtons: formValues.linkButtons,
        followUpEnabled: formValues.followUpEnabled,
      }),
    [formValues, keywordInput],
  );
  const isValid = validationIssues.length === 0;

  async function handleSubmit(goLive: boolean) {
    if (!selectedAccount || !isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const result = await createAutomation({
        accountId: selectedAccount.id,
        ...buildCommentAutomationMutationValues(formValues, keywordInput),
        goLive,
      });

      router.push(`/dashboard/automations/comments/${result.automationId}`);
    } catch (error) {
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
              New comment automation
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
              {isSubmitting ? "Saving..." : "Go live"}
            </button>
          </div>
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
