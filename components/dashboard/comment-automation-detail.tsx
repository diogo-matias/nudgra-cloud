"use client";

import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { CommentAutomationPreview } from "@/components/dashboard/comment-automation-preview";
import {
  DetailCard,
  DetailRow,
  InlineWarning,
  StatusBadge,
  ValidationIssuesNotice,
} from "@/components/dashboard/automation-shared-ui";
import {
  formatCommentAutomationTimestamp,
  getCommentAutomationLatestSessionSummary,
  getCommentAutomationStepLabel,
  type LinkLike,
} from "@/lib/comment-automation-ui";

type MediaOption = {
  mediaId: string;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  caption: string | null;
};

type LatestSessionLike = {
  currentStep: string;
  collectedEmail: string | null;
  outboundMessageCount: number;
  guardrailTrippedAt: number | null;
  guardrailReason: string | null;
  linkSentAt: number | null;
  linkClickedAt: number | null;
  followUpScheduledAt: number | null;
  followUpSentAt: number | null;
  startedAt: number;
  lastStepAt: number;
};

type CommentAutomationDetailProps = {
  automation: {
    name: string;
    status: "draft" | "live" | "paused";
    guardrailTrippedAt: number | null;
    guardrailReason: string | null;
    validationIssues: string[];
    triggerCount: number;
    lastTriggeredAt: number | null;
    latestSession: LatestSessionLike | null;
    postScope: "specific" | "any" | "next";
    selectedMediaIds: string[];
    nextPostActivatedAt: number | null;
    nextLockedMediaId: string | null;
    nextLockedAt: number | null;
    commentFilter: "specific_words" | "any_word";
    triggerKeywordLabels: string[];
    commentReplyEnabled: boolean;
    commentReplyTexts: string[];
    openingDmEnabled: boolean;
    openingDmText: string;
    openingDmButtonText: string;
    followGateEnabled: boolean;
    followGateText: string;
    emailCollectionEnabled: boolean;
    emailCollectionText: string;
    linkDmText: string;
    linkButtons: LinkLike[];
    followUpEnabled: boolean;
    followUpText: string;
  };
  media: MediaOption[];
  username?: string | null;
  profilePictureUrl?: string | null;
};

export function CommentAutomationDetail(props: CommentAutomationDetailProps) {
  const automationSelectedMedia = props.media.filter((item) =>
    props.automation.selectedMediaIds.includes(item.mediaId),
  );
  const lockedMedia =
    props.automation.nextLockedMediaId === null
      ? null
      : props.media.find(
          (item) => item.mediaId === props.automation.nextLockedMediaId,
        ) ?? null;
  const latestSessionSummary = getCommentAutomationLatestSessionSummary(
    props.automation.latestSession,
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex max-w-xl flex-col gap-5">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground">
                  {props.automation.name}
                </h1>
                <StatusBadge status={props.automation.status} />
                {props.automation.guardrailTrippedAt ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/5 px-2 py-0.5 text-[10px] font-medium text-destructive">
                    <AlertTriangle className="size-3" />
                    Safety paused
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Triggered {props.automation.triggerCount} time
                {props.automation.triggerCount === 1 ? "" : "s"}
                {props.automation.lastTriggeredAt
                  ? ` · Last: ${new Date(
                      props.automation.lastTriggeredAt,
                    ).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
          </div>

          {props.automation.validationIssues.length > 0 ? (
            <ValidationIssuesNotice
              title="This automation must be fixed before it can go live again"
              issues={props.automation.validationIssues}
            />
          ) : null}

          {props.automation.guardrailReason ? (
            <ValidationIssuesNotice
              title="Safety guardrail paused this automation"
              issues={[
                props.automation.guardrailReason,
                `Paused at ${formatCommentAutomationTimestamp(
                  props.automation.guardrailTrippedAt,
                )}. Review the latest session before turning it back on.`,
              ]}
            />
          ) : null}

          <DetailCard title="Runtime status">
            <DetailRow
              label="Latest session"
              value={latestSessionSummary ?? "No sessions yet"}
            />
            {props.automation.latestSession ? (
              <>
                <DetailRow
                  label="Current step"
                  value={getCommentAutomationStepLabel(
                    props.automation.latestSession.currentStep,
                  )}
                />
                <DetailRow
                  label="Outbound DMs"
                  value={String(
                    props.automation.latestSession.outboundMessageCount,
                  )}
                />
                <DetailRow
                  label="Last activity"
                  value={formatCommentAutomationTimestamp(
                    props.automation.latestSession.lastStepAt,
                  )}
                />
                <DetailRow
                  label="Tracked click"
                  value={formatCommentAutomationTimestamp(
                    props.automation.latestSession.linkClickedAt,
                  )}
                />
                <DetailRow
                  label="Follow-up sent"
                  value={formatCommentAutomationTimestamp(
                    props.automation.latestSession.followUpSentAt,
                  )}
                />
                {props.automation.latestSession.guardrailTrippedAt ||
                props.automation.latestSession.guardrailReason ? (
                  <DetailRow
                    label="Safety guardrail"
                    value={
                      props.automation.latestSession.guardrailReason ??
                      formatCommentAutomationTimestamp(
                        props.automation.latestSession.guardrailTrippedAt,
                      )
                    }
                  />
                ) : null}
              </>
            ) : null}

            {props.automation.postScope === "next" ? (
              <>
                <DetailRow
                  label="Activated"
                  value={formatCommentAutomationTimestamp(
                    props.automation.nextPostActivatedAt,
                  )}
                />
                <DetailRow
                  label="Locked post"
                  value={
                    lockedMedia?.caption?.trim()
                      ? lockedMedia.caption
                      : props.automation.nextLockedMediaId ??
                        "Waiting for the next published post"
                  }
                />
                <DetailRow
                  label="Locked at"
                  value={formatCommentAutomationTimestamp(
                    props.automation.nextLockedAt,
                  )}
                />
                {lockedMedia ? (
                  <MediaThumb
                    src={lockedMedia.thumbnailUrl || lockedMedia.mediaUrl}
                    alt={lockedMedia.caption ?? "Locked post"}
                    sizeClassName="size-16"
                  />
                ) : null}
              </>
            ) : null}
          </DetailCard>

          <DetailCard title="Trigger">
            <DetailRow
              label="Posts"
              value={
                props.automation.postScope === "specific"
                  ? `${props.automation.selectedMediaIds.length} specific post${props.automation.selectedMediaIds.length !== 1 ? "s" : ""}`
                  : props.automation.postScope === "any"
                    ? "All posts and reels"
                    : "Next post only"
              }
            />
            {props.automation.postScope === "specific" &&
            automationSelectedMedia.length > 0 ? (
              <div className="flex gap-2">
                {automationSelectedMedia.slice(0, 4).map((item) => (
                  <MediaThumb
                    key={item.mediaId}
                    src={item.thumbnailUrl || item.mediaUrl}
                    alt={item.caption ?? "Post"}
                    sizeClassName="size-14"
                  />
                ))}
                {automationSelectedMedia.length > 4 ? (
                  <div className="flex size-14 items-center justify-center rounded-lg border border-border bg-muted">
                    <span className="text-xs font-medium text-muted-foreground">
                      +{automationSelectedMedia.length - 4}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <DetailRow
              label="Comment filter"
              value={
                props.automation.commentFilter === "specific_words"
                  ? "Specific keywords"
                  : "Any comment"
              }
            />
            {props.automation.triggerKeywordLabels.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Keywords
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {props.automation.triggerKeywordLabels.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </DetailCard>

          {props.automation.commentReplyEnabled ? (
            <DetailCard title="Comment reply">
              {props.automation.commentReplyTexts.map((text, index) => (
                <p
                  key={`${text}-${index}`}
                  className="text-sm leading-relaxed text-foreground"
                >
                  {text}
                </p>
              ))}
            </DetailCard>
          ) : null}

          {props.automation.openingDmEnabled ? (
            <DetailCard title="Opening DM">
              <DetailRow label="Message" value={props.automation.openingDmText} />
              <DetailRow
                label="Button"
                value={props.automation.openingDmButtonText}
              />
            </DetailCard>
          ) : null}

          {props.automation.followGateEnabled ? (
            <DetailCard title="Follow gate">
              <DetailRow label="Message" value={props.automation.followGateText} />
              <InlineWarning text="Follow status is checked after the user interacts in DM. If Meta still requires profile consent, the automation asks them to send a reply and then re-checks." />
            </DetailCard>
          ) : null}

          {props.automation.emailCollectionEnabled ? (
            <DetailCard title="Email collection">
              <DetailRow
                label="Message"
                value={props.automation.emailCollectionText}
              />
            </DetailCard>
          ) : null}

          <DetailCard title="Link delivery">
            <DetailRow label="Message" value={props.automation.linkDmText} />
            {props.automation.linkButtons.length > 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Link buttons are rewritten into tracked redirect URLs before they
                are sent.
              </p>
            ) : null}
            {props.automation.linkButtons.length > 0 ? (
              <div className="flex flex-col gap-2">
                {props.automation.linkButtons.map((link, index) => (
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
            ) : (
              <DetailRow label="Links" value="-" />
            )}
          </DetailCard>

          {props.automation.followUpEnabled ? (
            <DetailCard title="Follow-up">
              <DetailRow label="Message" value={props.automation.followUpText} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Sends once after 6 hours, only if no tracked link click is
                recorded and the 24-hour messaging window is still open.
              </p>
            </DetailCard>
          ) : null}
        </div>
      </div>

      <div className="hidden w-[380px] shrink-0 items-start justify-center overflow-y-auto border-l border-border bg-muted/30 py-8 lg:flex">
        <CommentAutomationPreview
          config={{
            commentReplyEnabled: props.automation.commentReplyEnabled,
            commentReplyTexts: props.automation.commentReplyTexts,
            triggerKeywords: props.automation.triggerKeywordLabels,
            openingDmEnabled: props.automation.openingDmEnabled,
            openingDmText: props.automation.openingDmText,
            openingDmButtonText: props.automation.openingDmButtonText,
            followGateEnabled: props.automation.followGateEnabled,
            followGateText: props.automation.followGateText,
            emailCollectionEnabled: props.automation.emailCollectionEnabled,
            emailCollectionText: props.automation.emailCollectionText,
            linkDmText: props.automation.linkDmText,
            linkButtons: props.automation.linkButtons,
            followUpEnabled: props.automation.followUpEnabled,
            followUpText: props.automation.followUpText,
            validationIssues: props.automation.validationIssues,
            username: props.username ?? undefined,
            profilePictureUrl: props.profilePictureUrl ?? undefined,
            selectedPostThumbnail:
              automationSelectedMedia[0]?.thumbnailUrl ||
              automationSelectedMedia[0]?.mediaUrl ||
              null,
            selectedPostCaption: automationSelectedMedia[0]?.caption ?? null,
          }}
        />
      </div>
    </div>
  );
}

function MediaThumb({
  src,
  alt,
  sizeClassName,
}: {
  src: string | null;
  alt: string;
  sizeClassName: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-border ${sizeClassName}`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="64px"
          className="object-cover"
        />
      ) : (
        <div className="h-full w-full bg-muted" />
      )}
    </div>
  );
}
