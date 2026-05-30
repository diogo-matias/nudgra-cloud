"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { AutomationDeleteDialog } from "@/components/dashboard/automation-delete-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FollowerAutomationForm } from "@/components/dashboard/follower-automation-form";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";
import { getFollowerAutomationFormValidationIssues } from "@/lib/follower-automation-ui";

export default function FollowerAutomationDetailPage() {
  const params = useParams<{ automationId: string }>();
  const router = useRouter();
  const automationId = params.automationId as Id<"followerAutomations">;
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;
  const automation = useQuery(
    api.automations.followerAutomations.getFollowerAutomationById,
    selectedAccount ? { accountId: selectedAccount.id, automationId } : "skip",
  );
  const options = useQuery(
    api.automations.followerAutomations.getFollowerAutomationCreationOptions,
    selectedAccount ? { accountId: selectedAccount.id } : "skip",
  );
  const updateFollowerAutomation = useMutation(
    api.automations.followerAutomations.updateFollowerAutomation,
  );
  const toggleFollowerAutomation = useMutation(
    api.automations.followerAutomations.toggleFollowerAutomation,
  );
  const deleteFollowerAutomation = useMutation(
    api.automations.followerAutomations.deleteFollowerAutomation,
  );

  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState("");
  const [welcomeDmText, setWelcomeDmText] = useState("");
  const [emailCollectionEnabled, setEmailCollectionEnabled] = useState(false);
  const [emailCollectionText, setEmailCollectionText] = useState("");
  const [linkDmText, setLinkDmText] = useState("");
  const [linkButtons, setLinkButtons] = useState<
    Array<{ label: string; url: string }>
  >([]);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpText, setFollowUpText] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<Id<"tags">[]>([]);
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
    setWelcomeDmText(automation.welcomeDmText);
    setEmailCollectionEnabled(automation.emailCollectionEnabled);
    setEmailCollectionText(automation.emailCollectionText);
    setLinkDmText(automation.linkDmText);
    setLinkButtons(automation.linkButtons);
    setFollowUpEnabled(automation.followUpEnabled);
    setFollowUpText(automation.followUpText);
    setSelectedTagIds(automation.tagIds);
    setInitialized(true);
  }, [automation, initialized]);

  const validationIssues = getFollowerAutomationFormValidationIssues({
    name,
    welcomeDmText,
    linkDmText,
    linkButtons,
    followUpEnabled,
  });
  const canGoLive =
    validationIssues.length === 0 && automation?.canGoLive === true;

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
      await updateFollowerAutomation({
        accountId: selectedAccount.id,
        automationId,
        name,
        welcomeDmText,
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
          : "Failed to update follower automation.",
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
      await deleteFollowerAutomation({
        accountId: selectedAccount.id,
        automationId,
      });
      router.push("/dashboard/automations");
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Failed to delete follower automation.",
      );
      setIsDeleting(false);
    }
  }

  if (selectedAccount === null) {
    return (
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active Instagram account from the sidebar before opening follower automation details."
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
            Follower automation not found.
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
                  void toggleFollowerAutomation({
                    accountId: selectedAccount.id,
                    automationId,
                    status: automation.status === "live" ? "paused" : "live",
                  })
                }
                disabled={automation.status !== "live" && !canGoLive}
                title={
                  automation.status !== "live" && automation.unsupportedReason
                    ? automation.unsupportedReason
                    : undefined
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

        {automation.unsupportedReason ? (
          <div className="border-b border-amber-200 bg-amber-50 px-8 py-3 text-sm text-amber-900">
            {automation.unsupportedReason}
          </div>
        ) : null}

        <FollowerAutomationForm
          name={name}
          onNameChange={setName}
          welcomeDmText={welcomeDmText}
          onWelcomeDmTextChange={setWelcomeDmText}
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
      </main>

      <AutomationDeleteDialog
        open={showDeleteDialog}
        onOpenChange={handleDeleteDialogChange}
        automationKind="follower"
        automationName={automation.name}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
