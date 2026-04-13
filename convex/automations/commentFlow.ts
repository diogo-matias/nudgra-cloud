import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  MutationCtx,
} from "../_generated/server";
import { v } from "convex/values";
import { META_GRAPH_API_VERSION, requireSiteUrl } from "../meta/config";
import {
  type AutomatedButton,
  queueAutomatedButtonTemplate,
  queueAutomatedTextReply,
} from "../meta/sendHelpers";
import {
  AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT,
  AUTOMATION_CONVERSATION_BURST_WINDOW_MS,
  formatGuardrailWindowLabel,
  getRecentConversationOutboundAttemptCount,
} from "./guardrails";
import {
  isMetaAuthError,
  isMetaConsentRequiredError,
  parseMetaApiError,
} from "../meta/authShared";

type CommentAutomation = Doc<"commentAutomations">;
type WebUrlButton = Extract<AutomatedButton, { type: "web_url" }>;

type CommentAutomationLike = Pick<
  CommentAutomation,
  | "status"
  | "postScope"
  | "followGateEnabled"
  | "followUpEnabled"
  | "linkButtons"
  | "linkUrl"
  | "linkButtonText"
  | "nextPostActivatedAt"
  | "nextLockedMediaId"
>;

type StartSessionArgs = {
  workspaceId: Id<"workspaces">;
  instagramAccountId: Id<"instagramAccounts">;
  commentAutomationId: Id<"commentAutomations">;
  contactId: Id<"contacts">;
  conversationId: Id<"conversations">;
  commentId: string | null;
  mediaId: string | null;
};

type AdvanceSessionInput = {
  hasMessage: boolean;
  text: string | null;
  postbackPayload: string | null;
  quickReplyPayload: string | null;
};
type FollowGateCheckStatus = "following" | "not_following" | "consent_required";
type FollowGateInputMode = "button" | "reply";

const FOLLOW_UP_DELAY_MS = 6 * 60 * 60 * 1000;
const COMMENT_AUTOMATION_SESSION_MESSAGE_LIMIT = 8;
const INVALID_EMAIL_PROMPT =
  "Please send a valid email address so I can send the link.";
const DEFAULT_LINK_BUTTON_TEXT = "Open link";
const DEFAULT_LINK_MESSAGE = "Tap below to open your link.";
const DEFAULT_LINK_BATCH_MESSAGE = "More links";
const DEFAULT_FOLLOW_GATE_MESSAGE =
  "Please follow our account first, then tap below so I can verify and send the link.";
const FOLLOW_GATE_CONSENT_MESSAGE =
  "Follow our account, then send any message here so I can verify and send the link.";
const OPENING_DM_POSTBACK_PAYLOAD = "comment_automation:opening_dm";
const FOLLOW_GATE_POSTBACK_PAYLOAD = "comment_automation:follow_gate";
const FOLLOW_GATE_BUTTON_TEXT = "I'm following";

function getFollowGateInputMode(consentRequired: boolean): FollowGateInputMode {
  return consentRequired ? "reply" : "button";
}

function hasInboundInteraction(inbound: AdvanceSessionInput) {
  return (
    inbound.hasMessage ||
    inbound.postbackPayload !== null ||
    inbound.quickReplyPayload !== null
  );
}

function matchesFollowGateInteraction(
  session: Pick<Doc<"commentAutomationSessions">, "followGateInputMode">,
  inbound: AdvanceSessionInput,
) {
  const inputMode = session.followGateInputMode ?? "button";

  if (inputMode === "button") {
    return inbound.postbackPayload === FOLLOW_GATE_POSTBACK_PAYLOAD;
  }

  return hasInboundInteraction(inbound);
}

function isTerminalSessionStep(
  step: Doc<"commentAutomationSessions">["currentStep"],
) {
  return (
    step === "completed" || step === "link_sent" || step === "guardrail_tripped"
  );
}

function buildGuardrailReason(args: {
  limitType: "session" | "conversation_window";
  limit: number;
  purpose: string;
  windowMs?: number;
}) {
  const suffix = args.limit === 1 ? "" : "s";
  if (args.limitType === "session") {
    return `Safety guardrail paused this automation after ${args.limit} outbound DM${suffix} in the same session while sending ${args.purpose}.`;
  }

  return `Safety guardrail paused this automation after ${args.limit} outbound DM${suffix} from the same automation type in the same conversation within ${formatGuardrailWindowLabel(args.windowMs ?? AUTOMATION_CONVERSATION_BURST_WINDOW_MS)} while sending ${args.purpose}.`;
}

async function tripCommentAutomationGuardrail(
  ctx: MutationCtx,
  args: {
    session: Doc<"commentAutomationSessions">;
    automation: CommentAutomation;
    reason: string;
  },
) {
  const trippedAt = Date.now();

  await ctx.db.patch(args.session._id, {
    currentStep: "guardrail_tripped",
    guardrailTrippedAt: trippedAt,
    guardrailReason: args.reason,
    followGateInputMode: null,
    lastStepAt: trippedAt,
  });

  await ctx.db.patch(args.automation._id, {
    status: "paused",
    guardrailTrippedAt: trippedAt,
    guardrailReason: args.reason,
    guardrailSessionId: args.session._id,
    guardrailConversationId: args.session.conversationId,
  });
}

async function queueGuardedCommentAutomationTextReply(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"commentAutomationSessions">;
    automation: CommentAutomation;
    messageText: string;
    purpose: string;
    allowCompletedSession?: boolean;
  },
) {
  const session = await ctx.db.get(args.sessionId);
  if (
    session === null ||
    session.currentStep === "guardrail_tripped" ||
    (!args.allowCompletedSession && session.currentStep === "completed") ||
    (session.guardrailTrippedAt ?? null) !== null ||
    args.automation.status !== "live"
  ) {
    return false;
  }

  const sessionOutboundCount = session.outboundMessageCount ?? 0;
  if (sessionOutboundCount + 1 > COMMENT_AUTOMATION_SESSION_MESSAGE_LIMIT) {
    await tripCommentAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildGuardrailReason({
        limitType: "session",
        limit: COMMENT_AUTOMATION_SESSION_MESSAGE_LIMIT,
        purpose: args.purpose,
      }),
    });
    return false;
  }

  const conversationOutboundCount =
    await getRecentConversationOutboundAttemptCount(
      ctx,
      session.conversationId,
      "comment_automation",
    );
  if (
    conversationOutboundCount + 1 >
    AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT
  ) {
    await tripCommentAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildGuardrailReason({
        limitType: "conversation_window",
        limit: AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT,
        purpose: args.purpose,
        windowMs: AUTOMATION_CONVERSATION_BURST_WINDOW_MS,
      }),
    });
    return false;
  }

  await queueAutomatedTextReply(ctx, {
    workspaceId: session.workspaceId,
    instagramAccountId: session.instagramAccountId,
    conversationId: session.conversationId,
    contactId: session.contactId,
    messageText: args.messageText,
    automationRuleId: null,
    sequenceEnrollmentId: null,
  });

  await ctx.db.patch(session._id, {
    outboundMessageCount: sessionOutboundCount + 1,
    lastStepAt: Date.now(),
  });

  return true;
}

async function queueGuardedCommentAutomationButtonTemplate(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"commentAutomationSessions">;
    automation: CommentAutomation;
    messageText: string;
    buttons: AutomatedButton[];
    purpose: string;
    allowCompletedSession?: boolean;
  },
) {
  const session = await ctx.db.get(args.sessionId);
  if (
    session === null ||
    session.currentStep === "guardrail_tripped" ||
    (!args.allowCompletedSession && session.currentStep === "completed") ||
    (session.guardrailTrippedAt ?? null) !== null ||
    args.automation.status !== "live"
  ) {
    return false;
  }

  const sessionOutboundCount = session.outboundMessageCount ?? 0;
  if (sessionOutboundCount + 1 > COMMENT_AUTOMATION_SESSION_MESSAGE_LIMIT) {
    await tripCommentAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildGuardrailReason({
        limitType: "session",
        limit: COMMENT_AUTOMATION_SESSION_MESSAGE_LIMIT,
        purpose: args.purpose,
      }),
    });
    return false;
  }

  const conversationOutboundCount =
    await getRecentConversationOutboundAttemptCount(
      ctx,
      session.conversationId,
      "comment_automation",
    );
  if (
    conversationOutboundCount + 1 >
    AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT
  ) {
    await tripCommentAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildGuardrailReason({
        limitType: "conversation_window",
        limit: AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT,
        purpose: args.purpose,
        windowMs: AUTOMATION_CONVERSATION_BURST_WINDOW_MS,
      }),
    });
    return false;
  }

  await queueAutomatedButtonTemplate(ctx, {
    workspaceId: session.workspaceId,
    instagramAccountId: session.instagramAccountId,
    conversationId: session.conversationId,
    contactId: session.contactId,
    messageText: args.messageText,
    buttons: args.buttons,
    automationRuleId: null,
    sequenceEnrollmentId: null,
  });

  await ctx.db.patch(session._id, {
    outboundMessageCount: sessionOutboundCount + 1,
    lastStepAt: Date.now(),
  });

  return true;
}

function chunkButtons(buttons: AutomatedButton[], size: number) {
  const chunks: AutomatedButton[][] = [];

  for (let index = 0; index < buttons.length; index += size) {
    chunks.push(buttons.slice(index, index + size));
  }

  return chunks;
}

function getLinkButtons(
  automation: Pick<
    CommentAutomation,
    "linkButtons" | "linkUrl" | "linkButtonText"
  >,
): WebUrlButton[] {
  if (automation.linkButtons && automation.linkButtons.length > 0) {
    return automation.linkButtons.map((button) => ({
      type: "web_url" as const,
      title: button.label.trim() || DEFAULT_LINK_BUTTON_TEXT,
      url: button.url.trim(),
    }));
  }

  const legacyUrl = automation.linkUrl.trim();
  if (!legacyUrl) {
    return [];
  }

  return [
    {
      type: "web_url" as const,
      title: automation.linkButtonText?.trim() || DEFAULT_LINK_BUTTON_TEXT,
      url: legacyUrl,
    },
  ];
}

export function getCommentAutomationValidationIssues(
  automation: CommentAutomationLike,
) {
  const issues: string[] = [];

  if (automation.followUpEnabled && getLinkButtons(automation).length === 0) {
    issues.push("Follow-up requires at least one tracked link button.");
  }

  if (
    automation.postScope === "next" &&
    automation.status === "live" &&
    (automation.nextPostActivatedAt ?? null) === null
  ) {
    issues.push("Next-post automation must be reactivated before it can run.");
  }

  return issues;
}

async function getLatestSessionsForContactAutomation(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  commentAutomationId: Id<"commentAutomations">,
) {
  return await ctx.db
    .query("commentAutomationSessions")
    .withIndex("by_contact_id_and_comment_automation_id", (q) =>
      q
        .eq("contactId", contactId)
        .eq("commentAutomationId", commentAutomationId),
    )
    .order("desc")
    .take(10);
}

export async function startCommentAutomationSession(
  ctx: MutationCtx,
  automation: CommentAutomation,
  args: StartSessionArgs,
) {
  if (getCommentAutomationValidationIssues(automation).length > 0) {
    return null;
  }

  const now = Date.now();

  const existingSessions = await getLatestSessionsForContactAutomation(
    ctx,
    args.contactId,
    args.commentAutomationId,
  );
  const activeSession = existingSessions.find(
    (session) => !isTerminalSessionStep(session.currentStep),
  );

  if (activeSession) {
    return null;
  }

  let firstStep: Doc<"commentAutomationSessions">["currentStep"];

  if (automation.openingDmEnabled && automation.openingDmText.trim()) {
    firstStep = "opening_dm_sent";
  } else if (automation.followGateEnabled) {
    firstStep = "follow_gate_sent";
  } else if (
    automation.emailCollectionEnabled &&
    automation.emailCollectionText.trim()
  ) {
    firstStep = "email_requested";
  } else {
    firstStep = "link_sent";
  }

  const sessionId = await ctx.db.insert("commentAutomationSessions", {
    workspaceId: args.workspaceId,
    commentAutomationId: args.commentAutomationId,
    contactId: args.contactId,
    conversationId: args.conversationId,
    instagramAccountId: args.instagramAccountId,
    currentStep: firstStep,
    collectedEmail: null,
    commentId: args.commentId,
    mediaId: args.mediaId,
    startedAt: now,
    lastStepAt: now,
    outboundMessageCount: 0,
    followGateInputMode: null,
    lastInboundDeliveryKey: null,
    guardrailTrippedAt: null,
    guardrailReason: null,
    linkSentAt: null,
    linkClickedAt: null,
    followUpScheduledAt: null,
    followUpSentAt: null,
  });

  await ctx.runMutation(internal.contacts.upsertContactAutomationMembership, {
    workspaceId: args.workspaceId,
    contactId: args.contactId,
    conversationId: args.conversationId,
    automationKind: "comment_automation",
    automationRuleId: null,
    commentAutomationId: args.commentAutomationId,
    storyAutomationId: null,
    sequenceDefinitionId: null,
    matchedAt: now,
  });

  if (firstStep === "opening_dm_sent") {
    await sendOpeningDm(ctx, {
      sessionId,
      automation,
    });

    const currentSession = await ctx.db.get(sessionId);
    if (currentSession?.currentStep !== "guardrail_tripped") {
      await ctx.db.patch(sessionId, {
        currentStep: "awaiting_button_click",
        lastStepAt: Date.now(),
      });
    }
  } else if (firstStep === "follow_gate_sent") {
    await sendFollowGate(ctx, {
      sessionId,
      automation,
      consentRequired: false,
    });

    const currentSession = await ctx.db.get(sessionId);
    if (currentSession?.currentStep !== "guardrail_tripped") {
      await ctx.db.patch(sessionId, {
        currentStep: "awaiting_follow",
        followGateInputMode: getFollowGateInputMode(false),
        lastStepAt: Date.now(),
      });
    }
  } else if (firstStep === "email_requested") {
    await queueGuardedCommentAutomationTextReply(ctx, {
      sessionId,
      automation,
      messageText: automation.emailCollectionText,
      purpose: "the email prompt",
    });

    const currentSession = await ctx.db.get(sessionId);
    if (currentSession?.currentStep !== "guardrail_tripped") {
      await ctx.db.patch(sessionId, {
        currentStep: "awaiting_email",
        followGateInputMode: null,
        lastStepAt: Date.now(),
      });
    }
  } else {
    await sendLinkDm(ctx, { sessionId, automation });
  }

  await ctx.db.patch(automation._id, {
    triggerCount: automation.triggerCount + 1,
    lastTriggeredAt: now,
  });

  return sessionId;
}

export async function advanceCommentAutomationSession(
  ctx: MutationCtx,
  sessionId: Id<"commentAutomationSessions">,
  inbound: AdvanceSessionInput,
) {
  const session = await ctx.db.get(sessionId);
  if (!session || isTerminalSessionStep(session.currentStep)) {
    return null;
  }

  const automation = await ctx.db.get(session.commentAutomationId);
  if (!automation) {
    return null;
  }

  if (getCommentAutomationValidationIssues(automation).length > 0) {
    return null;
  }

  const now = Date.now();

  switch (session.currentStep) {
    case "awaiting_button_click":
    case "opening_dm_sent": {
      if (inbound.postbackPayload !== OPENING_DM_POSTBACK_PAYLOAD) {
        return null;
      }

      if (automation.followGateEnabled) {
        await sendFollowGate(ctx, {
          sessionId,
          automation,
          consentRequired: false,
        });
        const updatedSession = await ctx.db.get(sessionId);
        if (updatedSession?.currentStep !== "guardrail_tripped") {
          await ctx.db.patch(sessionId, {
            currentStep: "awaiting_follow",
            followGateInputMode: getFollowGateInputMode(false),
            lastStepAt: now,
          });
        }
      } else if (
        automation.emailCollectionEnabled &&
        automation.emailCollectionText.trim()
      ) {
        await queueGuardedCommentAutomationTextReply(ctx, {
          sessionId,
          automation,
          messageText: automation.emailCollectionText,
          purpose: "the email prompt",
        });
        const updatedSession = await ctx.db.get(sessionId);
        if (updatedSession?.currentStep !== "guardrail_tripped") {
          await ctx.db.patch(sessionId, {
            currentStep: "awaiting_email",
            followGateInputMode: null,
            lastStepAt: now,
          });
        }
      } else {
        await sendLinkDm(ctx, { sessionId, automation });
      }
      break;
    }

    case "follow_gate_sent":
    case "awaiting_follow": {
      return session.currentStep;
    }

    case "email_requested":
    case "awaiting_email": {
      const email = extractEmail(inbound.text);
      if (email === null) {
        await queueGuardedCommentAutomationTextReply(ctx, {
          sessionId,
          automation,
          messageText: INVALID_EMAIL_PROMPT,
          purpose: "the email retry prompt",
        });
        const updatedSession = await ctx.db.get(sessionId);
        if (updatedSession?.currentStep !== "guardrail_tripped") {
          await ctx.db.patch(sessionId, {
            currentStep: "awaiting_email",
            followGateInputMode: null,
            lastStepAt: now,
          });
        }
        return session.currentStep;
      }

      await ctx.db.patch(sessionId, {
        collectedEmail: email,
        lastStepAt: now,
      });
      await ctx.runMutation(internal.contacts.upsertCollectedContactEmail, {
        workspaceId: session.workspaceId,
        instagramAccountId: session.instagramAccountId,
        contactId: session.contactId,
        conversationId: session.conversationId,
        email,
        collectedAt: now,
        automationKind: "comment_automation",
        automationRuleId: null,
        commentAutomationId: automation._id,
        storyAutomationId: null,
      });

      await sendLinkDm(ctx, { sessionId, automation });
      break;
    }

    default:
      break;
  }

  return session.currentStep;
}

async function continueAfterFollowGate(
  ctx: MutationCtx,
  args: {
    session: Doc<"commentAutomationSessions">;
    automation: CommentAutomation;
  },
) {
  const now = Date.now();

  if (
    args.automation.emailCollectionEnabled &&
    args.automation.emailCollectionText.trim()
  ) {
    await queueGuardedCommentAutomationTextReply(ctx, {
      sessionId: args.session._id,
      automation: args.automation,
      messageText: args.automation.emailCollectionText,
      purpose: "the email prompt",
    });
    const updatedSession = await ctx.db.get(args.session._id);
    if (updatedSession?.currentStep !== "guardrail_tripped") {
      await ctx.db.patch(args.session._id, {
        currentStep: "awaiting_email",
        followGateInputMode: null,
        lastStepAt: now,
      });
    }
    return;
  }

  await sendLinkDm(ctx, {
    sessionId: args.session._id,
    automation: args.automation,
  });
}

async function sendOpeningDm(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"commentAutomationSessions">;
    automation: CommentAutomation;
  },
) {
  const buttonTitle = args.automation.openingDmButtonText.trim();

  if (!buttonTitle) {
    return await queueGuardedCommentAutomationTextReply(ctx, {
      sessionId: args.sessionId,
      automation: args.automation,
      messageText: args.automation.openingDmText,
      purpose: "the opening DM",
    });
  }

  return await queueGuardedCommentAutomationButtonTemplate(ctx, {
    sessionId: args.sessionId,
    automation: args.automation,
    messageText: args.automation.openingDmText,
    buttons: [
      {
        type: "postback",
        title: buttonTitle,
        payload: OPENING_DM_POSTBACK_PAYLOAD,
      },
    ],
    purpose: "the opening DM",
  });
}

function getFollowGateMessage(
  automation: Pick<CommentAutomation, "followGateText">,
  consentRequired: boolean,
) {
  const baseMessage =
    automation.followGateText.trim() || DEFAULT_FOLLOW_GATE_MESSAGE;

  if (!consentRequired) {
    return baseMessage;
  }

  return `${baseMessage}\n\n${FOLLOW_GATE_CONSENT_MESSAGE}`;
}

async function sendFollowGate(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"commentAutomationSessions">;
    automation: CommentAutomation;
    consentRequired: boolean;
  },
) {
  const messageText = getFollowGateMessage(
    args.automation,
    args.consentRequired,
  );

  if (args.consentRequired) {
    return await queueGuardedCommentAutomationTextReply(ctx, {
      sessionId: args.sessionId,
      automation: args.automation,
      messageText,
      purpose: "the follow gate prompt",
    });
  }

  return await queueGuardedCommentAutomationButtonTemplate(ctx, {
    sessionId: args.sessionId,
    automation: args.automation,
    messageText,
    buttons: [
      {
        type: "postback",
        title: FOLLOW_GATE_BUTTON_TEXT,
        payload: FOLLOW_GATE_POSTBACK_PAYLOAD,
      },
    ],
    purpose: "the follow gate prompt",
  });
}

async function sendLinkDm(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"commentAutomationSessions">;
    automation: CommentAutomation;
  },
) {
  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    return;
  }

  const messageText = args.automation.linkDmText.trim() || DEFAULT_LINK_MESSAGE;
  const rawLinkButtons = getLinkButtons(args.automation);
  const trackedButtons: WebUrlButton[] = [];

  if (rawLinkButtons.length > 0) {
    const siteUrl = requireSiteUrl();
    const createdAt = Date.now();

    for (const [buttonIndex, button] of rawLinkButtons.entries()) {
      const token = crypto.randomUUID();
      await ctx.db.insert("commentAutomationTrackedLinks", {
        workspaceId: session.workspaceId,
        instagramAccountId: session.instagramAccountId,
        commentAutomationId: session.commentAutomationId,
        sessionId: session._id,
        token,
        destinationUrl: button.url,
        label: button.title,
        buttonIndex,
        clickedAt: null,
        createdAt,
      });

      trackedButtons.push({
        type: "web_url",
        title: button.title,
        url: new URL(
          `/api/comment-automation/links/${token}`,
          siteUrl,
        ).toString(),
      });
    }
  }

  if (trackedButtons.length > 0) {
    const buttonBatches = chunkButtons(trackedButtons, 3);

    for (const [index, buttons] of buttonBatches.entries()) {
      const queued = await queueGuardedCommentAutomationButtonTemplate(ctx, {
        sessionId: session._id,
        automation: args.automation,
        messageText: index === 0 ? messageText : DEFAULT_LINK_BATCH_MESSAGE,
        buttons,
        purpose: "the link delivery",
      });
      if (!queued) {
        return;
      }
    }
  } else {
    const queued = await queueGuardedCommentAutomationTextReply(ctx, {
      sessionId: session._id,
      automation: args.automation,
      messageText,
      purpose: "the link delivery",
    });
    if (!queued) {
      return;
    }
  }

  const now = Date.now();
  const nextPatch: Partial<Doc<"commentAutomationSessions">> = {
    currentStep: "completed",
    lastStepAt: now,
    followGateInputMode: null,
    linkSentAt: now,
  };

  if (
    args.automation.followUpEnabled &&
    args.automation.followUpText.trim() &&
    trackedButtons.length > 0 &&
    (session.followUpScheduledAt ?? null) === null
  ) {
    nextPatch.followUpScheduledAt = now + FOLLOW_UP_DELAY_MS;

    await ctx.scheduler.runAfter(
      FOLLOW_UP_DELAY_MS,
      internal.automations.commentFlow.processScheduledFollowUp,
      { sessionId: session._id },
    );
  }

  await ctx.db.patch(session._id, nextPatch);
}

export const processScheduledFollowUp = internalMutation({
  args: { sessionId: v.id("commentAutomationSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      return null;
    }

    if (
      (session.followUpScheduledAt ?? null) === null ||
      (session.followUpSentAt ?? null) !== null ||
      (session.linkClickedAt ?? null) !== null ||
      (session.guardrailTrippedAt ?? null) !== null
    ) {
      return null;
    }

    const automation = await ctx.db.get(session.commentAutomationId);
    const conversation = await ctx.db.get(session.conversationId);

    if (
      automation === null ||
      conversation === null ||
      automation.status !== "live" ||
      !automation.followUpEnabled ||
      !automation.followUpText.trim() ||
      getCommentAutomationValidationIssues(automation).length > 0
    ) {
      return null;
    }

    const now = Date.now();
    const followUpScheduledAt = session.followUpScheduledAt ?? null;
    if (followUpScheduledAt === null || followUpScheduledAt > now) {
      return null;
    }

    if (
      conversation.messagingWindowClosesAt !== null &&
      conversation.messagingWindowClosesAt < now
    ) {
      await ctx.db.patch(conversation._id, { status: "window_closed" });
      return null;
    }

    const queued = await queueGuardedCommentAutomationTextReply(ctx, {
      sessionId: session._id,
      automation,
      messageText: automation.followUpText.trim(),
      purpose: "the follow-up DM",
      allowCompletedSession: true,
    });
    if (!queued) {
      return null;
    }

    await ctx.db.patch(session._id, {
      followUpSentAt: now,
      lastStepAt: now,
    });

    return null;
  },
});

export const advanceCommentAutomationSessionInternal = internalMutation({
  args: {
    sessionId: v.id("commentAutomationSessions"),
    hasMessage: v.boolean(),
    text: v.union(v.string(), v.null()),
    postbackPayload: v.union(v.string(), v.null()),
    quickReplyPayload: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    return await advanceCommentAutomationSession(ctx, args.sessionId, {
      hasMessage: args.hasMessage,
      text: args.text,
      postbackPayload: args.postbackPayload,
      quickReplyPayload: args.quickReplyPayload,
    });
  },
});

export const getCommentAutomationSessionActionContext = internalQuery({
  args: { sessionId: v.id("commentAutomationSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      return null;
    }

    const automation = await ctx.db.get(session.commentAutomationId);
    const account = await ctx.db.get(session.instagramAccountId);
    const contact = await ctx.db.get(session.contactId);

    if (automation === null || account === null || contact === null) {
      return null;
    }

    return { session, automation, account, contact };
  },
});

async function checkInstagramFollowGateStatus(
  ctx: ActionCtx,
  args: {
    accountId: Id<"instagramAccounts">;
    accessToken: string;
    graphApiVersion: string;
    instagramScopedUserId: string;
  },
): Promise<FollowGateCheckStatus> {
  const request = async (accessToken: string) => {
    const endpoint = new URL(
      `https://graph.instagram.com/${
        args.graphApiVersion || META_GRAPH_API_VERSION
      }/${args.instagramScopedUserId}`,
    );
    endpoint.searchParams.set("fields", "is_user_follow_business");
    endpoint.searchParams.set("access_token", accessToken);

    const response = await fetch(endpoint);
    const responseText = await response.text();

    if (!response.ok) {
      return {
        ok: false as const,
        error: parseMetaApiError(
          responseText,
          "Failed to verify whether the Instagram user follows the business account.",
        ),
      };
    }

    return {
      ok: true as const,
      payload: JSON.parse(responseText) as {
        is_user_follow_business?: boolean;
      },
    };
  };

  let result = await request(args.accessToken);
  if (!result.ok && isMetaAuthError(result.error)) {
    const refreshResult: { tokenUsable: boolean } = await ctx.runAction(
      internal.meta.tokenLifecycle.refreshAccountToken,
      {
        accountId: args.accountId,
        reason: "auth_error",
      },
    );

    if (refreshResult.tokenUsable) {
      const refreshedAccount = await ctx.runQuery(
        internal.accounts.getAccountTokenLifecycleContext,
        {
          accountId: args.accountId,
        },
      );
      if (refreshedAccount?.graphAccessToken) {
        result = await request(refreshedAccount.graphAccessToken);
      }
    }
  }

  if (!result.ok) {
    if (isMetaConsentRequiredError(result.error)) {
      return "consent_required";
    }

    throw new Error(result.error.message);
  }

  return result.payload.is_user_follow_business ? "following" : "not_following";
}

export const handleFollowGateCheckResult = internalMutation({
  args: {
    sessionId: v.id("commentAutomationSessions"),
    deliveryKey: v.union(v.string(), v.null()),
    status: v.union(
      v.literal("following"),
      v.literal("not_following"),
      v.literal("consent_required"),
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      return null;
    }

    const automation = await ctx.db.get(session.commentAutomationId);
    if (automation === null) {
      return null;
    }

    if (args.status === "following") {
      await ctx.db.patch(session._id, {
        lastInboundDeliveryKey: args.deliveryKey,
      });
      await continueAfterFollowGate(ctx, {
        session,
        automation,
      });
      return null;
    }

    await sendFollowGate(ctx, {
      sessionId: session._id,
      automation,
      consentRequired: args.status === "consent_required",
    });

    const updatedSession = await ctx.db.get(session._id);
    if (updatedSession?.currentStep !== "guardrail_tripped") {
      await ctx.db.patch(session._id, {
        currentStep: "awaiting_follow",
        followGateInputMode: getFollowGateInputMode(
          args.status === "consent_required",
        ),
        lastInboundDeliveryKey: args.deliveryKey,
        lastStepAt: Date.now(),
      });
    }

    return null;
  },
});

export const processInboundCommentAutomationInteraction = internalAction({
  args: {
    sessionId: v.id("commentAutomationSessions"),
    hasMessage: v.boolean(),
    text: v.union(v.string(), v.null()),
    postbackPayload: v.union(v.string(), v.null()),
    quickReplyPayload: v.union(v.string(), v.null()),
    deliveryKey: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.automations.commentFlow.getCommentAutomationSessionActionContext,
      { sessionId: args.sessionId },
    );

    if (context === null) {
      return null;
    }

    const { session, automation, account, contact } = context;
    if (
      args.deliveryKey !== null &&
      (session.lastInboundDeliveryKey ?? null) === args.deliveryKey
    ) {
      return null;
    }

    const isOpeningStep =
      session.currentStep === "opening_dm_sent" ||
      session.currentStep === "awaiting_button_click";
    const isFollowStep =
      session.currentStep === "follow_gate_sent" ||
      session.currentStep === "awaiting_follow";

    if (!automation.followGateEnabled || (!isOpeningStep && !isFollowStep)) {
      await ctx.runMutation(
        internal.automations.commentFlow
          .advanceCommentAutomationSessionInternal,
        {
          sessionId: args.sessionId,
          hasMessage: args.hasMessage,
          text: args.text,
          postbackPayload: args.postbackPayload,
          quickReplyPayload: args.quickReplyPayload,
        },
      );
      return null;
    }

    if (isOpeningStep && args.postbackPayload !== OPENING_DM_POSTBACK_PAYLOAD) {
      return null;
    }

    if (
      isFollowStep &&
      !matchesFollowGateInteraction(session, {
        hasMessage: args.hasMessage,
        text: args.text,
        postbackPayload: args.postbackPayload,
        quickReplyPayload: args.quickReplyPayload,
      })
    ) {
      return null;
    }

    const followStatus =
      account.graphAccessToken === null
        ? ("consent_required" as const)
        : await checkInstagramFollowGateStatus(ctx, {
            accountId: account._id,
            accessToken: account.graphAccessToken,
            graphApiVersion: account.graphApiVersion,
            instagramScopedUserId: contact.instagramUserId,
          });

    await ctx.runMutation(
      internal.automations.commentFlow.handleFollowGateCheckResult,
      {
        sessionId: session._id,
        deliveryKey: args.deliveryKey,
        status: followStatus,
      },
    );

    return null;
  },
});

function extractEmail(text: string | null): string | null {
  if (!text) {
    return null;
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

export function matchesCommentAutomation(args: {
  automation: Pick<
    CommentAutomation,
    | "postScope"
    | "selectedMediaIds"
    | "commentFilter"
    | "triggerKeywords"
    | "nextLockedMediaId"
  >;
  mediaId: string;
  commentText: string | null;
}) {
  if (args.automation.postScope === "specific") {
    if (!args.automation.selectedMediaIds.includes(args.mediaId)) {
      return false;
    }
  }

  if (args.automation.postScope === "next") {
    if ((args.automation.nextLockedMediaId ?? null) !== args.mediaId) {
      return false;
    }
  }

  if (args.automation.commentFilter === "any_word") {
    return true;
  }

  if (!args.commentText) {
    return false;
  }

  const normalizedText = args.commentText.trim().toLowerCase();
  if (!normalizedText) {
    return false;
  }

  return args.automation.triggerKeywords.some((keyword) =>
    normalizedText.includes(keyword),
  );
}
