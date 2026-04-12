"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  ActiveBadge,
  DetailCard,
  DetailRow,
  InlineWarning,
  ValidationIssuesNotice,
} from "@/components/dashboard/automation-shared-ui";
import { RuleAutomationForm } from "@/components/dashboard/rule-automation-form";
import { RuleAutomationPreview } from "@/components/dashboard/rule-automation-preview";
import { SelectedAccountEmptyState } from "@/components/dashboard/selected-account-empty-state";
import {
  formatRuleAutomationTimestamp,
  getNormalizedRuleAutomationKeywords,
  getRuleAutomationFormValidationIssues,
  getRuleAutomationLatestSessionSummary,
  getRuleAutomationStepLabel,
} from "@/lib/rule-automation-ui";

export default function RuleDetailPage() {
  const params = useParams<{ ruleId: string }>();
  const ruleId = params.ruleId as Id<"automationRules">;
  const accountContext = useQuery(api.accounts.getSelectedAccountContext);
  const selectedAccount = accountContext?.selectedAccount ?? null;
  const rule = useQuery(
    api.automations.rules.getRuleById,
    selectedAccount
      ? {
          accountId: selectedAccount.id,
          ruleId,
        }
      : "skip",
  );
  const options = useQuery(
    api.automations.rules.getRuleCreationOptions,
    selectedAccount ? { accountId: selectedAccount.id } : "skip",
  );
  const updateRule = useMutation(api.automations.rules.updateRule);
  const toggleRule = useMutation(api.automations.rules.toggleRule);

  const [name, setName] = useState("");
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [linkDmText, setLinkDmText] = useState("");
  const [linkButtons, setLinkButtons] = useState<
    Array<{ label: string; url: string }>
  >([]);
  const [followGateEnabled, setFollowGateEnabled] = useState(false);
  const [followGateText, setFollowGateText] = useState("");
  const [emailCollectionEnabled, setEmailCollectionEnabled] = useState(false);
  const [emailCollectionText, setEmailCollectionText] = useState("");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpText, setFollowUpText] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<Id<"tags">[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] =
    useState<Id<"sequenceDefinitions"> | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (rule && !initialized) {
      setName(rule.name);
      setTriggerKeywords(rule.triggerKeywordLabels);
      setKeywordInput("");
      setLinkDmText(rule.linkDmText);
      setLinkButtons(rule.linkButtons);
      setFollowGateEnabled(rule.followGateEnabled);
      setFollowGateText(rule.followGateText);
      setEmailCollectionEnabled(rule.emailCollectionEnabled);
      setEmailCollectionText(rule.emailCollectionText);
      setFollowUpEnabled(rule.followUpEnabled);
      setFollowUpText(rule.followUpText);
      setSelectedTagIds(rule.tags.map((tag) => tag.id));
      setSelectedSequenceId(rule.sequence?.id ?? null);
      setIsActive(rule.isActive);
      setInitialized(true);
    }
  }, [initialized, rule]);

  const normalizedTriggerKeywords = getNormalizedRuleAutomationKeywords(
    triggerKeywords,
    keywordInput,
  );
  const validationIssues = getRuleAutomationFormValidationIssues({
    name,
    triggerKeywords: normalizedTriggerKeywords,
    linkDmText,
    linkButtons,
    followUpEnabled,
  });
  const isKeywordRule = rule?.triggerType === "keyword";
  const isValid =
    validationIssues.length === 0 && Boolean(options?.hasConnectedAccount);
  const latestSessionSummary = getRuleAutomationLatestSessionSummary(
    rule?.latestSession,
  );

  async function handleSave() {
    if (!selectedAccount || !rule || !isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      await updateRule({
        accountId: selectedAccount.id,
        ruleId: rule.id,
        name,
        triggerType: rule.triggerType,
        matchType: rule.matchType,
        keywords:
          rule.triggerType === "keyword" ? normalizedTriggerKeywords : [],
        replyText: linkDmText,
        linkDmText,
        linkButtons,
        followGateEnabled,
        followGateText,
        emailCollectionEnabled,
        emailCollectionText,
        followUpEnabled,
        followUpText,
        isActive,
        tagIds: selectedTagIds,
        sequenceDefinitionId: selectedSequenceId,
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

  function handleCancelEdit() {
    if (rule) {
      setName(rule.name);
      setTriggerKeywords(rule.triggerKeywordLabels);
      setKeywordInput("");
      setLinkDmText(rule.linkDmText);
      setLinkButtons(rule.linkButtons);
      setFollowGateEnabled(rule.followGateEnabled);
      setFollowGateText(rule.followGateText);
      setEmailCollectionEnabled(rule.emailCollectionEnabled);
      setEmailCollectionText(rule.emailCollectionText);
      setFollowUpEnabled(rule.followUpEnabled);
      setFollowUpText(rule.followUpText);
      setSelectedTagIds(rule.tags.map((tag) => tag.id));
      setSelectedSequenceId(rule.sequence?.id ?? null);
      setIsActive(rule.isActive);
    }
    setSubmissionError(null);
    setIsEditing(false);
  }

  if (selectedAccount === null) {
    return (
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SelectedAccountEmptyState
          title="No active Instagram account"
          description="Choose an active account from the sidebar before opening DM automation details."
        />
      </main>
    );
  }

  if (rule === undefined) {
    return (
      <main className="flex-1 px-8 py-10">
        <div className="max-w-3xl rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Loading automation...
        </div>
      </main>
    );
  }

  if (rule === null) {
    return (
      <main className="flex-1 px-8 py-10">
        <div className="max-w-3xl flex flex-col gap-4">
          <Link
            href="/dashboard/automations"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to automations
          </Link>
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Rule not found.
          </div>
        </div>
      </main>
    );
  }

  if (isEditing && isKeywordRule) {
    return (
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-background px-8 py-4">
          <div className="flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Cancel editing
              </button>
              <span className="text-border">/</span>
              <span className="text-sm font-medium text-foreground">
                Edit DM automation
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={!isValid || isSubmitting}
                onClick={() => void handleSave()}
                className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>

        <RuleAutomationForm
          name={name}
          onNameChange={setName}
          triggerKeywords={triggerKeywords}
          keywordInput={keywordInput}
          onKeywordInputChange={setKeywordInput}
          onTriggerKeywordsChange={setTriggerKeywords}
          linkDmText={linkDmText}
          onLinkDmTextChange={setLinkDmText}
          linkButtons={linkButtons}
          onLinkButtonsChange={setLinkButtons}
          followGateEnabled={followGateEnabled}
          onFollowGateEnabledChange={setFollowGateEnabled}
          followGateText={followGateText}
          onFollowGateTextChange={setFollowGateText}
          emailCollectionEnabled={emailCollectionEnabled}
          onEmailCollectionEnabledChange={setEmailCollectionEnabled}
          emailCollectionText={emailCollectionText}
          onEmailCollectionTextChange={setEmailCollectionText}
          followUpEnabled={followUpEnabled}
          onFollowUpEnabledChange={setFollowUpEnabled}
          followUpText={followUpText}
          onFollowUpTextChange={setFollowUpText}
          tagOptions={options?.tags ?? []}
          selectedTagIds={selectedTagIds}
          onSelectedTagIdsChange={setSelectedTagIds}
          sequenceOptions={options?.sequences ?? []}
          selectedSequenceId={selectedSequenceId}
          onSelectedSequenceIdChange={setSelectedSequenceId}
          isActive={isActive}
          onIsActiveChange={setIsActive}
          validationIssues={validationIssues}
          submissionError={submissionError}
          username={selectedAccount.username}
          profilePictureUrl={selectedAccount.profilePictureUrl}
        />
      </main>
    );
  }

  return (
    <main className="flex-1 px-8 py-10">
      <div className="flex max-w-7xl gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Link
            href="/dashboard/automations"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to automations
          </Link>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <ActiveBadge isActive={rule.isActive} />
                <h1 className="text-xl font-semibold text-foreground">
                  {rule.name}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Triggered {rule.triggerCount} time
                {rule.triggerCount === 1 ? "" : "s"}.
                {" "}Last updated{" "}
                {new Date(rule.lastModifiedAt).toLocaleString()}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isKeywordRule ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Edit
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  void toggleRule({
                    accountId: selectedAccount.id,
                    ruleId: rule.id,
                    isActive: !rule.isActive,
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {rule.isActive ? (
                  <ToggleRight className="size-5 text-primary" />
                ) : (
                  <ToggleLeft className="size-5" />
                )}
                {rule.isActive ? "Pause" : "Go live"}
              </button>
            </div>
          </div>

          {!isKeywordRule ? (
            <ValidationIssuesNotice
              title="Story reply rules are still on the legacy flow"
              issues={[
                "This overhaul only applies to keyword-triggered DM automations.",
                "This rule will keep using the existing one-step reply behavior until story reply automation is redesigned.",
              ]}
            />
          ) : null}

          {rule.validationIssues.length > 0 ? (
            <ValidationIssuesNotice
              title="This automation has blocking issues"
              issues={rule.validationIssues}
            />
          ) : null}

          <DetailCard title="Runtime status">
            <DetailRow
              label="Latest session"
              value={latestSessionSummary ?? "No sessions yet"}
            />
            {rule.latestSession ? (
              <>
                <DetailRow
                  label="Current step"
                  value={getRuleAutomationStepLabel(rule.latestSession.currentStep)}
                />
                <DetailRow
                  label="Outbound DMs"
                  value={String(rule.latestSession.outboundMessageCount)}
                />
                <DetailRow
                  label="Last activity"
                  value={formatRuleAutomationTimestamp(
                    rule.latestSession.lastStepAt,
                  )}
                />
                <DetailRow
                  label="Tracked click"
                  value={formatRuleAutomationTimestamp(
                    rule.latestSession.linkClickedAt,
                  )}
                />
                <DetailRow
                  label="Follow-up sent"
                  value={formatRuleAutomationTimestamp(
                    rule.latestSession.followUpSentAt,
                  )}
                />
              </>
            ) : null}
          </DetailCard>

          <DetailCard title="Trigger">
            <DetailRow label="Type" value={rule.triggerType.replace("_", " ")} />
            <DetailRow label="Match" value={rule.matchType} />
            {rule.triggerKeywordLabels.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Keywords
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rule.triggerKeywordLabels.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This rule listens for story replies.
              </p>
            )}
          </DetailCard>

          <DetailCard title="Link DM">
            <DetailRow label="Message" value={rule.linkDmText} />
            {rule.linkButtons.length > 0 ? (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Link buttons are rewritten into tracked redirect URLs before
                  they are sent.
                </p>
                <div className="flex flex-col gap-2">
                  {rule.linkButtons.map((link, index) => (
                    <div
                      key={`${link.label}-${link.url}-${index}`}
                      className="rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {link.label}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {link.url}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <DetailRow label="Links" value="-" />
            )}
          </DetailCard>

          {rule.followGateEnabled ? (
            <DetailCard title="Follow gate">
              <DetailRow label="Message" value={rule.followGateText} />
              <InlineWarning text="Follow status is verified after the user interacts in DM. If Meta still requires profile consent, the automation asks them to send another reply and then re-checks." />
            </DetailCard>
          ) : null}

          {rule.emailCollectionEnabled ? (
            <DetailCard title="Email collection">
              <DetailRow label="Message" value={rule.emailCollectionText} />
            </DetailCard>
          ) : null}

          {rule.followUpEnabled ? (
            <DetailCard title="Follow-up">
              <DetailRow label="Message" value={rule.followUpText} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Sends once after 6 hours, only if no tracked link click is
                recorded and the 24-hour messaging window is still open.
              </p>
            </DetailCard>
          ) : null}

          <DetailCard title="Advanced">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Tags</p>
                {rule.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {rule.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
                      >
                        <Tag className="size-3" />
                        {tag.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground">No tags applied.</p>
                )}
              </div>

              <DetailRow
                label="Sequence"
                value={rule.sequence ? rule.sequence.name : "No sequence"}
              />
            </div>
          </DetailCard>
        </div>

        <div className="hidden w-[380px] shrink-0 items-start justify-center border-l border-border bg-muted/30 py-8 lg:flex">
          <RuleAutomationPreview
            config={{
              triggerKeywords: rule.triggerKeywordLabels,
              followGateEnabled: rule.followGateEnabled,
              followGateText: rule.followGateText,
              emailCollectionEnabled: rule.emailCollectionEnabled,
              emailCollectionText: rule.emailCollectionText,
              linkDmText: rule.linkDmText,
              linkButtons: rule.linkButtons,
              followUpEnabled: rule.followUpEnabled,
              followUpText: rule.followUpText,
              validationIssues: rule.validationIssues,
              username: selectedAccount.username,
              profilePictureUrl: selectedAccount.profilePictureUrl,
            }}
          />
        </div>
      </div>
    </main>
  );
}
