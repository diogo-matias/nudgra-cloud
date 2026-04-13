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
  queueAutomatedStoryReaction,
  queueAutomatedTextReply,
} from "../meta/sendHelpers";
import {
  isMetaAuthError,
  isMetaConsentRequiredError,
  parseMetaApiError,
} from "../meta/authShared";
import {
  extractEmail,
  getEffectiveStoryLinkDmText,
  getStoryAutomationValidationIssues as getSharedStoryAutomationValidationIssues,
  STORY_DEFAULT_FOLLOW_GATE_MESSAGE,
  STORY_DEFAULT_LINK_BATCH_MESSAGE,
  STORY_DEFAULT_LINK_MESSAGE,
  STORY_FOLLOW_GATE_BUTTON_TEXT,
  STORY_FOLLOW_GATE_CONSENT_MESSAGE,
  STORY_FOLLOW_UP_DELAY_MS,
  STORY_INVALID_EMAIL_PROMPT,
  STORY_REACTION_EMOJI,
} from "./storyShared";

type StoryAutomation = Doc<"storyAutomations">;
type WebUrlButton = Extract<AutomatedButton, { type: "web_url" }>;
type StoryAutomationLike = Pick<
  StoryAutomation,
  | "status"
  | "storyScope"
  | "selectedStoryId"
  | "selectedStoryPermalink"
  | "selectedStoryExpiredAt"
  | "replyFilter"
  | "triggerTokens"
  | "reactionEnabled"
  | "followGateEnabled"
  | "followUpEnabled"
  | "linkButtons"
  | "linkUrl"
  | "linkButtonText"
> & {
  linkDmText?: string;
};

type StartSessionArgs = {
  workspaceId: Id<"workspaces">;
  instagramAccountId: Id<"instagramAccounts">;
  storyAutomationId: Id<"storyAutomations">;
  contactId: Id<"contacts">;
  conversationId: Id<"conversations">;
  matchedAt: number;
  triggerMessageId: string | null;
  storyId: string | null;
  storyUrl: string | null;
  storyToken: string | null;
};

type AdvanceSessionInput = {
  hasMessage: boolean;
  text: string | null;
  postbackPayload: string | null;
  quickReplyPayload: string | null;
};

type FollowGateCheckStatus = "following" | "not_following" | "consent_required";
type FollowGateInputMode = "button" | "reply";

const STORY_AUTOMATION_SESSION_MESSAGE_LIMIT = 8;
const STORY_AUTOMATION_CONVERSATION_MESSAGE_LIMIT = 10;
const FOLLOW_GATE_POSTBACK_PAYLOAD = "story_automation:follow_gate";

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
  session: Pick<Doc<"storyAutomationSessions">, "followGateInputMode">,
  inbound: AdvanceSessionInput,
) {
  const inputMode = session.followGateInputMode ?? "button";

  if (inputMode === "button") {
    return inbound.postbackPayload === FOLLOW_GATE_POSTBACK_PAYLOAD;
  }

  return hasInboundInteraction(inbound);
}

function isTerminalSessionStep(
  step: Doc<"storyAutomationSessions">["currentStep"],
) {
  return (
    step === "completed" || step === "link_sent" || step === "guardrail_tripped"
  );
}

function buildGuardrailReason(args: {
  limitType: "session" | "conversation";
  limit: number;
  purpose: string;
}) {
  return `Safety guardrail paused this story automation after ${args.limit} outbound DM${args.limit === 1 ? "" : "s"} in the same ${args.limitType} while sending ${args.purpose}.`;
}

function getLinkButtons(
  automation: Pick<
    StoryAutomationLike,
    "linkButtons" | "linkUrl" | "linkButtonText"
  >,
): WebUrlButton[] {
  if (automation.linkButtons && automation.linkButtons.length > 0) {
    return automation.linkButtons.map((button) => ({
      type: "web_url" as const,
      title: button.label.trim(),
      url: button.url.trim(),
    }));
  }

  if (automation.linkUrl.trim()) {
    return [
      {
        type: "web_url" as const,
        title: (automation.linkButtonText ?? "Open link").trim() || "Open link",
        url: automation.linkUrl.trim(),
      },
    ];
  }

  return [];
}

export function getStoryAutomationValidationIssues(
  automation: StoryAutomationLike,
) {
  const validationLinkButtons =
    automation.linkButtons && automation.linkButtons.length > 0
      ? automation.linkButtons
      : automation.linkUrl.trim()
        ? [
            {
              label:
                (automation.linkButtonText ?? "Open link").trim() || "Open link",
              url: automation.linkUrl.trim(),
            },
          ]
        : [];

  return getSharedStoryAutomationValidationIssues({
    storyScope: automation.storyScope,
    selectedStoryId: automation.selectedStoryId,
    selectedStoryExpiredAt: automation.selectedStoryExpiredAt ?? null,
    replyFilter: automation.replyFilter,
    triggerTokens: automation.triggerTokens,
    linkDmText: automation.linkDmText ?? "",
    linkButtons: validationLinkButtons,
    followUpEnabled: automation.followUpEnabled ?? false,
  });
}

async function getConversationOutboundMessageCount(
  ctx: MutationCtx,
  session: Pick<Doc<"storyAutomationSessions">, "conversationId">,
) {
  const sessions = await ctx.db
    .query("storyAutomationSessions")
    .withIndex("by_conversation_id", (q) =>
      q.eq("conversationId", session.conversationId),
    )
    .order("desc")
    .take(20);

  return sessions.reduce(
    (total, candidate) => total + (candidate.outboundMessageCount ?? 0),
    0,
  );
}

async function tripStoryAutomationGuardrail(
  ctx: MutationCtx,
  args: {
    session: Doc<"storyAutomationSessions">;
    automation: StoryAutomation;
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

async function queueGuardedStoryAutomationTextReply(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"storyAutomationSessions">;
    automation: StoryAutomation;
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
  if (sessionOutboundCount + 1 > STORY_AUTOMATION_SESSION_MESSAGE_LIMIT) {
    await tripStoryAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildGuardrailReason({
        limitType: "session",
        limit: STORY_AUTOMATION_SESSION_MESSAGE_LIMIT,
        purpose: args.purpose,
      }),
    });
    return false;
  }

  const conversationOutboundCount = await getConversationOutboundMessageCount(
    ctx,
    session,
  );
  if (
    conversationOutboundCount + 1 >
    STORY_AUTOMATION_CONVERSATION_MESSAGE_LIMIT
  ) {
    await tripStoryAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildGuardrailReason({
        limitType: "conversation",
        limit: STORY_AUTOMATION_CONVERSATION_MESSAGE_LIMIT,
        purpose: args.purpose,
      }),
    });
    return false;
  }

  await queueAutomatedTextReply(ctx, {
    workspaceId: session.workspaceId,
    instagramAccountId: session.instagramAccountId,
    conversationId: session.conversationId,
    contactId: session.contactId,
    automationRuleId: null,
    storyAutomationId: session.storyAutomationId,
    sequenceEnrollmentId: null,
    messageText: args.messageText,
  });

  await ctx.db.patch(session._id, {
    outboundMessageCount: sessionOutboundCount + 1,
    lastStepAt: Date.now(),
  });

  return true;
}

async function queueGuardedStoryAutomationButtonTemplate(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"storyAutomationSessions">;
    automation: StoryAutomation;
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
  if (sessionOutboundCount + 1 > STORY_AUTOMATION_SESSION_MESSAGE_LIMIT) {
    await tripStoryAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildGuardrailReason({
        limitType: "session",
        limit: STORY_AUTOMATION_SESSION_MESSAGE_LIMIT,
        purpose: args.purpose,
      }),
    });
    return false;
  }

  const conversationOutboundCount = await getConversationOutboundMessageCount(
    ctx,
    session,
  );
  if (
    conversationOutboundCount + 1 >
    STORY_AUTOMATION_CONVERSATION_MESSAGE_LIMIT
  ) {
    await tripStoryAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildGuardrailReason({
        limitType: "conversation",
        limit: STORY_AUTOMATION_CONVERSATION_MESSAGE_LIMIT,
        purpose: args.purpose,
      }),
    });
    return false;
  }

  await queueAutomatedButtonTemplate(ctx, {
    workspaceId: session.workspaceId,
    instagramAccountId: session.instagramAccountId,
    conversationId: session.conversationId,
    contactId: session.contactId,
    automationRuleId: null,
    storyAutomationId: session.storyAutomationId,
    sequenceEnrollmentId: null,
    messageText: args.messageText,
    buttons: args.buttons,
  });

  await ctx.db.patch(session._id, {
    outboundMessageCount: sessionOutboundCount + 1,
    lastStepAt: Date.now(),
  });

  return true;
}

async function queueGuardedStoryAutomationReaction(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"storyAutomationSessions">;
    automation: StoryAutomation;
    triggerMessageId: string;
    purpose: string;
  },
) {
  const session = await ctx.db.get(args.sessionId);
  if (
    session === null ||
    session.currentStep === "guardrail_tripped" ||
    (session.guardrailTrippedAt ?? null) !== null ||
    args.automation.status !== "live"
  ) {
    return false;
  }

  const sessionOutboundCount = session.outboundMessageCount ?? 0;
  if (sessionOutboundCount + 1 > STORY_AUTOMATION_SESSION_MESSAGE_LIMIT) {
    await tripStoryAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildGuardrailReason({
        limitType: "session",
        limit: STORY_AUTOMATION_SESSION_MESSAGE_LIMIT,
        purpose: args.purpose,
      }),
    });
    return false;
  }

  const conversationOutboundCount = await getConversationOutboundMessageCount(
    ctx,
    session,
  );
  if (
    conversationOutboundCount + 1 >
    STORY_AUTOMATION_CONVERSATION_MESSAGE_LIMIT
  ) {
    await tripStoryAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildGuardrailReason({
        limitType: "conversation",
        limit: STORY_AUTOMATION_CONVERSATION_MESSAGE_LIMIT,
        purpose: args.purpose,
      }),
    });
    return false;
  }

  await queueAutomatedStoryReaction(ctx, {
    workspaceId: session.workspaceId,
    instagramAccountId: session.instagramAccountId,
    conversationId: session.conversationId,
    contactId: session.contactId,
    automationRuleId: null,
    storyAutomationId: session.storyAutomationId,
    sequenceEnrollmentId: null,
    messageText: `Reacted with ${STORY_REACTION_EMOJI}`,
    emoji: STORY_REACTION_EMOJI,
    triggerMessageId: args.triggerMessageId,
  });

  await ctx.db.patch(session._id, {
    outboundMessageCount: sessionOutboundCount + 1,
    lastStepAt: Date.now(),
    reactionSentAt: Date.now(),
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

async function getLatestSessionsForStoryAutomation(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  storyAutomationId: Id<"storyAutomations">,
) {
  return await ctx.db
    .query("storyAutomationSessions")
    .withIndex("by_contact_id_and_story_automation_id", (q) =>
      q.eq("contactId", contactId).eq("storyAutomationId", storyAutomationId),
    )
    .order("desc")
    .take(10);
}

export async function startStoryAutomationSession(
  ctx: MutationCtx,
  automation: StoryAutomation,
  args: StartSessionArgs,
) {
  if (getStoryAutomationValidationIssues(automation).length > 0) {
    return null;
  }

  const existingSessions = await getLatestSessionsForStoryAutomation(
    ctx,
    args.contactId,
    args.storyAutomationId,
  );
  const activeSession = existingSessions.find(
    (session) => !isTerminalSessionStep(session.currentStep),
  );

  if (activeSession) {
    return null;
  }

  let firstStep: Doc<"storyAutomationSessions">["currentStep"];
  if (automation.followGateEnabled) {
    firstStep = "follow_gate_sent";
  } else if (
    automation.emailCollectionEnabled &&
    automation.emailCollectionText.trim()
  ) {
    firstStep = "email_requested";
  } else {
    firstStep = "link_sent";
  }

  const sessionId = await ctx.db.insert("storyAutomationSessions", {
    workspaceId: args.workspaceId,
    storyAutomationId: args.storyAutomationId,
    contactId: args.contactId,
    conversationId: args.conversationId,
    instagramAccountId: args.instagramAccountId,
    currentStep: firstStep,
    collectedEmail: null,
    triggerMessageId: args.triggerMessageId,
    storyId: args.storyId,
    storyUrl: args.storyUrl,
    storyToken: args.storyToken,
    startedAt: args.matchedAt,
    lastStepAt: args.matchedAt,
    outboundMessageCount: 0,
    followGateInputMode: null,
    lastInboundDeliveryKey: null,
    guardrailTrippedAt: null,
    guardrailReason: null,
    linkSentAt: null,
    linkClickedAt: null,
    followUpScheduledAt: null,
    followUpSentAt: null,
    reactionSentAt: null,
  });

  await ctx.runMutation(internal.contacts.upsertContactAutomationMembership, {
    workspaceId: args.workspaceId,
    contactId: args.contactId,
    conversationId: args.conversationId,
    automationKind: "story_automation",
    automationRuleId: null,
    commentAutomationId: null,
    storyAutomationId: args.storyAutomationId,
    sequenceDefinitionId: null,
    matchedAt: args.matchedAt,
  });

  if (automation.reactionEnabled && args.triggerMessageId?.trim()) {
    await queueGuardedStoryAutomationReaction(ctx, {
      sessionId,
      automation,
      triggerMessageId: args.triggerMessageId,
      purpose: "the story reply reaction",
    });
  }

  const reactionSession = await ctx.db.get(sessionId);
  if (reactionSession?.currentStep === "guardrail_tripped") {
    return sessionId;
  }

  if (firstStep === "follow_gate_sent") {
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
    await queueGuardedStoryAutomationTextReply(ctx, {
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
    lastTriggeredAt: args.matchedAt,
  });

  return sessionId;
}

export async function advanceStoryAutomationSession(
  ctx: MutationCtx,
  sessionId: Id<"storyAutomationSessions">,
  inbound: AdvanceSessionInput,
) {
  const session = await ctx.db.get(sessionId);
  if (!session || isTerminalSessionStep(session.currentStep)) {
    return null;
  }

  const automation = await ctx.db.get(session.storyAutomationId);
  if (!automation || getStoryAutomationValidationIssues(automation).length > 0) {
    return null;
  }

  const now = Date.now();

  switch (session.currentStep) {
    case "follow_gate_sent":
    case "awaiting_follow": {
      return session.currentStep;
    }

    case "email_requested":
    case "awaiting_email": {
      const email = extractEmail(inbound.text);
      if (email === null) {
        await queueGuardedStoryAutomationTextReply(ctx, {
          sessionId,
          automation,
          messageText: STORY_INVALID_EMAIL_PROMPT,
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
        automationKind: "story_automation",
        automationRuleId: null,
        commentAutomationId: null,
        storyAutomationId: automation._id,
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
    session: Doc<"storyAutomationSessions">;
    automation: StoryAutomation;
  },
) {
  const now = Date.now();

  if (
    args.automation.emailCollectionEnabled &&
    args.automation.emailCollectionText.trim()
  ) {
    await queueGuardedStoryAutomationTextReply(ctx, {
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

function getFollowGateMessage(
  automation: Pick<StoryAutomation, "followGateText">,
  consentRequired: boolean,
) {
  const baseMessage =
    automation.followGateText.trim() || STORY_DEFAULT_FOLLOW_GATE_MESSAGE;

  if (!consentRequired) {
    return baseMessage;
  }

  return `${baseMessage}\n\n${STORY_FOLLOW_GATE_CONSENT_MESSAGE}`;
}

async function sendFollowGate(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"storyAutomationSessions">;
    automation: StoryAutomation;
    consentRequired: boolean;
  },
) {
  const messageText = getFollowGateMessage(
    args.automation,
    args.consentRequired,
  );

  if (args.consentRequired) {
    return await queueGuardedStoryAutomationTextReply(ctx, {
      sessionId: args.sessionId,
      automation: args.automation,
      messageText,
      purpose: "the follow gate prompt",
    });
  }

  return await queueGuardedStoryAutomationButtonTemplate(ctx, {
    sessionId: args.sessionId,
    automation: args.automation,
    messageText,
    buttons: [
      {
        type: "postback",
        title: STORY_FOLLOW_GATE_BUTTON_TEXT,
        payload: FOLLOW_GATE_POSTBACK_PAYLOAD,
      },
    ],
    purpose: "the follow gate prompt",
  });
}

async function sendLinkDm(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"storyAutomationSessions">;
    automation: StoryAutomation;
  },
) {
  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    return;
  }

  const messageText =
    getEffectiveStoryLinkDmText({
      linkDmText: args.automation.linkDmText,
      hasLinkButtons: getLinkButtons(args.automation).length > 0,
    }) || STORY_DEFAULT_LINK_MESSAGE;
  const rawLinkButtons = getLinkButtons(args.automation);
  const trackedButtons: WebUrlButton[] = [];

  if (rawLinkButtons.length > 0) {
    const siteUrl = requireSiteUrl();
    const createdAt = Date.now();

    for (const [buttonIndex, button] of rawLinkButtons.entries()) {
      const token = crypto.randomUUID();
      await ctx.db.insert("storyAutomationTrackedLinks", {
        workspaceId: session.workspaceId,
        instagramAccountId: session.instagramAccountId,
        storyAutomationId: session.storyAutomationId,
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
        url: new URL(`/api/story-automation/links/${token}`, siteUrl).toString(),
      });
    }
  }

  if (trackedButtons.length > 0) {
    const buttonBatches = chunkButtons(trackedButtons, 3);

    for (const [index, buttons] of buttonBatches.entries()) {
      const queued = await queueGuardedStoryAutomationButtonTemplate(ctx, {
        sessionId: session._id,
        automation: args.automation,
        messageText:
          index === 0 ? messageText : STORY_DEFAULT_LINK_BATCH_MESSAGE,
        buttons,
        purpose: "the link delivery",
      });
      if (!queued) {
        return;
      }
    }
  } else {
    const queued = await queueGuardedStoryAutomationTextReply(ctx, {
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
  const nextPatch: Partial<Doc<"storyAutomationSessions">> = {
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
    nextPatch.followUpScheduledAt = now + STORY_FOLLOW_UP_DELAY_MS;

    await ctx.scheduler.runAfter(
      STORY_FOLLOW_UP_DELAY_MS,
      internal.automations.storyFlow.processScheduledFollowUp,
      { sessionId: session._id },
    );
  }

  await ctx.db.patch(session._id, nextPatch);
}

export const processScheduledFollowUp = internalMutation({
  args: { sessionId: v.id("storyAutomationSessions") },
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

    const automation = await ctx.db.get(session.storyAutomationId);
    const conversation = await ctx.db.get(session.conversationId);

    if (
      automation === null ||
      conversation === null ||
      automation.status !== "live" ||
      !automation.followUpEnabled ||
      !automation.followUpText.trim() ||
      getStoryAutomationValidationIssues(automation).length > 0
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

    const queued = await queueGuardedStoryAutomationTextReply(ctx, {
      sessionId: session._id,
      automation,
      messageText: automation.followUpText,
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

export const advanceStoryAutomationSessionInternal = internalMutation({
  args: {
    sessionId: v.id("storyAutomationSessions"),
    hasMessage: v.boolean(),
    text: v.union(v.string(), v.null()),
    postbackPayload: v.union(v.string(), v.null()),
    quickReplyPayload: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    return await advanceStoryAutomationSession(ctx, args.sessionId, {
      hasMessage: args.hasMessage,
      text: args.text,
      postbackPayload: args.postbackPayload,
      quickReplyPayload: args.quickReplyPayload,
    });
  },
});

export const getStoryAutomationSessionActionContext = internalQuery({
  args: { sessionId: v.id("storyAutomationSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      return null;
    }

    const automation = await ctx.db.get(session.storyAutomationId);
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
    sessionId: v.id("storyAutomationSessions"),
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

    const automation = await ctx.db.get(session.storyAutomationId);
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

export const processInboundStoryAutomationInteraction = internalAction({
  args: {
    sessionId: v.id("storyAutomationSessions"),
    hasMessage: v.boolean(),
    text: v.union(v.string(), v.null()),
    postbackPayload: v.union(v.string(), v.null()),
    quickReplyPayload: v.union(v.string(), v.null()),
    deliveryKey: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.automations.storyFlow.getStoryAutomationSessionActionContext,
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

    const isFollowStep =
      session.currentStep === "follow_gate_sent" ||
      session.currentStep === "awaiting_follow";

    if (!automation.followGateEnabled || !isFollowStep) {
      await ctx.runMutation(
        internal.automations.storyFlow.advanceStoryAutomationSessionInternal,
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

    if (
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
      internal.automations.storyFlow.handleFollowGateCheckResult,
      {
        sessionId: session._id,
        deliveryKey: args.deliveryKey,
        status: followStatus,
      },
    );

    return null;
  },
});
