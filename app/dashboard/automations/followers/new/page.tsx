"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FollowerAutomationForm } from "@/components/dashboard/follower-automation-form";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";
import { getFollowerAutomationFormValidationIssues } from "@/lib/follower-automation-ui";

export default function NewFollowerAutomationPage() {
  const router = useRouter();
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;
  const options = useQuery(
    api.automations.followerAutomations.getFollowerAutomationCreationOptions,
    selectedAccount ? { accountId: selectedAccount.id } : "skip",
  );
  const createFollowerAutomation = useMutation(
    api.automations.followerAutomations.createFollowerAutomation,
  );

  const [name, setName] = useState("");
  const [welcomeDmText, setWelcomeDmText] = useState(
    "Thanks for following! Glad you're here.",
  );
  const [emailCollectionEnabled, setEmailCollectionEnabled] = useState(false);
  const [emailCollectionText, setEmailCollectionText] = useState(
    "Drop your email and I'll send it right over:",
  );
  const [linkDmText, setLinkDmText] = useState("");
  const [linkButtons, setLinkButtons] = useState<
    Array<{ label: string; url: string }>
  >([]);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpText, setFollowUpText] = useState(
    "Just checking in - did you get the link?",
  );
  const [selectedTagIds, setSelectedTagIds] = useState<Id<"tags">[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const validationIssues = getFollowerAutomationFormValidationIssues({
    name,
    welcomeDmText,
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
      const result = await createFollowerAutomation({
        accountId: selectedAccount.id,
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
        sequenceDefinitionId: null,
        goLive,
      });

      router.push(`/dashboard/automations/followers/${result.automationId}`);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Failed to create follower automation.",
      );
      setIsSubmitting(false);
    }
  }

  if (selectedAccount === null) {
    return (
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active Instagram account from the sidebar before creating a follower automation."
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
              When someone follows you
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
          Connect an Instagram account before creating follower automations.
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
  );
}
