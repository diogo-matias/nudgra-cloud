import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { internalMutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
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
  buildAutomationGuardrailReason,
  chunkButtons,
  createTrackedLinkButtons,
  extractEmail,
} from "./sessionShared";

type FollowerAutomation = Doc<"followerAutomations">;
type WebUrlButton = Extract<AutomatedButton, { type: "web_url" }>;

const FOLLOWER_AUTOMATION_SESSION_MESSAGE_LIMIT = 8;
const FOLLOW_UP_DELAY_MS = 6 * 60 * 60 * 1000;
const DEFAULT_LINK_MESSAGE = "Tap below to open your link.";
const DEFAULT_LINK_BATCH_MESSAGE = "More links";
const INVALID_EMAIL_PROMPT =
  "Please send a valid email address so I can send the link.";

type StartSessionArgs = {
  workspaceId: Id<"workspaces">;
  instagramAccountId: Id<"instagramAccounts">;
  followerAutomationId: Id<"followerAutomations">;
  contactId: Id<"contacts">;
  conversationId: Id<"conversations">;
  followerEventKey: string;
  matchedAt: number;
};

type AdvanceSessionInput = {
  text: string | null;
};

function getLinkButtons(
  automation: Pick<
    FollowerAutomation,
    "linkButtons" | "linkUrl" | "linkButtonText"
  >,
): WebUrlButton[] {
  if (automation.linkButtons && automation.linkButtons.length > 0) {
    return automation.linkButtons.map((button) => ({
      type: "web_url" as const,
      title: button.label.trim() || "Open link",
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

export function getFollowerAutomationValidationIssues(
  automation: Pick<
    FollowerAutomation,
    "welcomeDmText" | "linkDmText" | "linkButtons" | "linkUrl" | "linkButtonText" | "followUpEnabled"
  >,
) {
  const issues: string[] = [];
  const linkButtons = getLinkButtons(automation);

  if (!automation.welcomeDmText.trim()) {
    issues.push("Welcome message is required.");
  }

  if (
    !automation.linkDmText.trim() &&
    linkButtons.length === 0 &&
    automation.followUpEnabled
  ) {
    issues.push("Follow-up requires at least one tracked link button.");
  }

  if (automation.followUpEnabled && linkButtons.length === 0) {
    issues.push("Follow-up requires at least one tracked link button.");
  }

  return [...new Set(issues)];
}

async function tripFollowerAutomationGuardrail(
  ctx: MutationCtx,
  args: {
    session: Doc<"followerAutomationSessions">;
    automation: FollowerAutomation;
    reason: string;
  },
) {
  const trippedAt = Date.now();

  await ctx.db.patch(args.session._id, {
    currentStep: "guardrail_tripped",
    guardrailTrippedAt: trippedAt,
    guardrailReason: args.reason,
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

async function queueGuardedFollowerAutomationTextReply(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"followerAutomationSessions">;
    automation: FollowerAutomation;
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
  if (sessionOutboundCount + 1 > FOLLOWER_AUTOMATION_SESSION_MESSAGE_LIMIT) {
    await tripFollowerAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildAutomationGuardrailReason({
        automationLabel: "follower automation",
        limitType: "session",
        limit: FOLLOWER_AUTOMATION_SESSION_MESSAGE_LIMIT,
        purpose: args.purpose,
        windowLabel: formatGuardrailWindowLabel(
          AUTOMATION_CONVERSATION_BURST_WINDOW_MS,
        ),
      }),
    });
    return false;
  }

  const conversationOutboundCount =
    await getRecentConversationOutboundAttemptCount(
      ctx,
      session.conversationId,
      "follower_automation",
    );
  if (
    conversationOutboundCount + 1 >
    AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT
  ) {
    await tripFollowerAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildAutomationGuardrailReason({
        automationLabel: "follower automation",
        limitType: "conversation_window",
        limit: AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT,
        purpose: args.purpose,
        windowLabel: formatGuardrailWindowLabel(
          AUTOMATION_CONVERSATION_BURST_WINDOW_MS,
        ),
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
    storyAutomationId: null,
    followerAutomationId: session.followerAutomationId,
    sequenceEnrollmentId: null,
    messageText: args.messageText,
  });

  await ctx.db.patch(session._id, {
    outboundMessageCount: sessionOutboundCount + 1,
    lastStepAt: Date.now(),
  });

  return true;
}

async function queueGuardedFollowerAutomationButtonTemplate(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"followerAutomationSessions">;
    automation: FollowerAutomation;
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
  if (sessionOutboundCount + 1 > FOLLOWER_AUTOMATION_SESSION_MESSAGE_LIMIT) {
    await tripFollowerAutomationGuardrail(ctx, {
      session,
      automation: args.automation,
      reason: buildAutomationGuardrailReason({
        automationLabel: "follower automation",
        limitType: "session",
        limit: FOLLOWER_AUTOMATION_SESSION_MESSAGE_LIMIT,
        purpose: args.purpose,
        windowLabel: formatGuardrailWindowLabel(
          AUTOMATION_CONVERSATION_BURST_WINDOW_MS,
        ),
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
    storyAutomationId: null,
    followerAutomationId: session.followerAutomationId,
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

async function getLatestSessionsForFollowerAutomation(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  followerAutomationId: Id<"followerAutomations">,
) {
  return await ctx.db
    .query("followerAutomationSessions")
    .withIndex("by_contact_id_and_follower_automation_id", (q) =>
      q.eq("contactId", contactId).eq("followerAutomationId", followerAutomationId),
    )
    .order("desc")
    .take(10);
}

export async function startFollowerAutomationSession(
  ctx: MutationCtx,
  automation: FollowerAutomation,
  args: StartSessionArgs,
) {
  if (automation.status !== "live") {
    return null;
  }

  if (getFollowerAutomationValidationIssues(automation).length > 0) {
    return null;
  }

  const duplicateEvent = await ctx.db
    .query("followerAutomationSessions")
    .withIndex("by_follower_event_key", (q) =>
      q.eq("followerEventKey", args.followerEventKey),
    )
    .unique();
  if (duplicateEvent !== null) {
    return duplicateEvent._id;
  }

  const existingSessions = await getLatestSessionsForFollowerAutomation(
    ctx,
    args.contactId,
    args.followerAutomationId,
  );
  const activeSession = existingSessions.find(
    (session) =>
      session.currentStep !== "completed" &&
      session.currentStep !== "link_sent" &&
      session.currentStep !== "guardrail_tripped",
  );
  if (activeSession) {
    return null;
  }

  const sessionId = await ctx.db.insert("followerAutomationSessions", {
    workspaceId: args.workspaceId,
    followerAutomationId: args.followerAutomationId,
    contactId: args.contactId,
    conversationId: args.conversationId,
    instagramAccountId: args.instagramAccountId,
    currentStep: "welcome_sent",
    collectedEmail: null,
    followerEventKey: args.followerEventKey,
    startedAt: args.matchedAt,
    lastStepAt: args.matchedAt,
    outboundMessageCount: 0,
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
    automationKind: "follower_automation",
    automationRuleId: null,
    commentAutomationId: null,
    storyAutomationId: null,
    followerAutomationId: args.followerAutomationId,
    sequenceDefinitionId: null,
    matchedAt: args.matchedAt,
  });

  const sentWelcome = await queueGuardedFollowerAutomationTextReply(ctx, {
    sessionId,
    automation,
    messageText: automation.welcomeDmText,
    purpose: "the welcome DM",
  });
  if (!sentWelcome) {
    return sessionId;
  }

  const currentSession = await ctx.db.get(sessionId);
  if (currentSession?.currentStep === "guardrail_tripped") {
    return sessionId;
  }

  if (
    automation.emailCollectionEnabled &&
    automation.emailCollectionText.trim()
  ) {
    await queueGuardedFollowerAutomationTextReply(ctx, {
      sessionId,
      automation,
      messageText: automation.emailCollectionText,
      purpose: "the email prompt",
    });
    const updatedSession = await ctx.db.get(sessionId);
    if (updatedSession?.currentStep !== "guardrail_tripped") {
      await ctx.db.patch(sessionId, {
        currentStep: "awaiting_email",
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

export async function advanceFollowerAutomationSession(
  ctx: MutationCtx,
  sessionId: Id<"followerAutomationSessions">,
  inbound: AdvanceSessionInput,
) {
  const session = await ctx.db.get(sessionId);
  if (
    !session ||
    session.currentStep === "completed" ||
    session.currentStep === "link_sent" ||
    session.currentStep === "guardrail_tripped"
  ) {
    return null;
  }

  const automation = await ctx.db.get(session.followerAutomationId);
  if (!automation || getFollowerAutomationValidationIssues(automation).length > 0) {
    return null;
  }

  if (session.currentStep !== "awaiting_email") {
    return session.currentStep;
  }

  const email = extractEmail(inbound.text);
  if (email === null) {
    await queueGuardedFollowerAutomationTextReply(ctx, {
      sessionId,
      automation,
      messageText: INVALID_EMAIL_PROMPT,
      purpose: "the email retry prompt",
    });
    return session.currentStep;
  }

  const now = Date.now();
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
    automationKind: "follower_automation",
    automationRuleId: null,
    commentAutomationId: null,
    storyAutomationId: null,
    followerAutomationId: automation._id,
  });

  await sendLinkDm(ctx, { sessionId, automation });
  return session.currentStep;
}

async function sendLinkDm(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"followerAutomationSessions">;
    automation: FollowerAutomation;
  },
) {
  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    return;
  }
  const conversation = await ctx.db.get(session.conversationId);
  if (conversation === null) {
    return;
  }

  const messageText = args.automation.linkDmText.trim() || DEFAULT_LINK_MESSAGE;
  const rawLinkButtons = getLinkButtons(args.automation);
  const trackedButtons = await createTrackedLinkButtons({
    buttons: rawLinkButtons,
    routePrefix: "/api/follower-automation/links",
    insertTrackedLink: async ({
      token,
      destinationUrl,
      label,
      buttonIndex,
      createdAt,
    }) => {
      await ctx.db.insert("followerAutomationTrackedLinks", {
        workspaceId: session.workspaceId,
        instagramAccountId: session.instagramAccountId,
        followerAutomationId: session.followerAutomationId,
        sessionId: session._id,
        token,
        destinationUrl,
        label,
        buttonIndex,
        clickedAt: null,
        createdAt,
      });
    },
  });

  if (trackedButtons.length > 0) {
    const buttonBatches = chunkButtons(trackedButtons, 3);
    for (const [index, buttons] of buttonBatches.entries()) {
      const queued = await queueGuardedFollowerAutomationButtonTemplate(ctx, {
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
  } else if (args.automation.linkDmText.trim()) {
    const queued = await queueGuardedFollowerAutomationTextReply(ctx, {
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
  const nextPatch: Partial<Doc<"followerAutomationSessions">> = {
    currentStep: "completed",
    lastStepAt: now,
    linkSentAt: rawLinkButtons.length > 0 || args.automation.linkDmText.trim() ? now : null,
  };

  if (
    args.automation.followUpEnabled &&
    args.automation.followUpText.trim() &&
    trackedButtons.length > 0 &&
    conversation.messagingWindowClosesAt !== null &&
    conversation.messagingWindowClosesAt >= now &&
    (session.followUpScheduledAt ?? null) === null
  ) {
    nextPatch.followUpScheduledAt = now + FOLLOW_UP_DELAY_MS;
    await ctx.scheduler.runAfter(
      FOLLOW_UP_DELAY_MS,
      internal.automations.followerFlow.processScheduledFollowUp,
      { sessionId: session._id },
    );
  }

  await ctx.db.patch(session._id, nextPatch);
}

export const processScheduledFollowUp = internalMutation({
  args: { sessionId: v.id("followerAutomationSessions") },
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

    const automation = await ctx.db.get(session.followerAutomationId);
    const conversation = await ctx.db.get(session.conversationId);
    if (
      automation === null ||
      conversation === null ||
      automation.status !== "live" ||
      !automation.followUpEnabled ||
      !automation.followUpText.trim() ||
      getFollowerAutomationValidationIssues(automation).length > 0
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

    const queued = await queueGuardedFollowerAutomationTextReply(ctx, {
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
