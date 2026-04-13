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
  isMetaAuthError,
  isMetaConsentRequiredError,
  parseMetaApiError,
} from "../meta/authShared";
import {
  AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT,
  AUTOMATION_CONVERSATION_BURST_WINDOW_MS,
  formatGuardrailWindowLabel,
  getRecentConversationOutboundAttemptCount,
} from "./guardrails";
import {
  extractEmail,
  getAutomationRuleValidationIssues,
  getEffectiveRuleLinkDmText,
  RULE_DEFAULT_FOLLOW_GATE_MESSAGE,
  RULE_DEFAULT_LINK_BATCH_MESSAGE,
  RULE_DEFAULT_LINK_MESSAGE,
  RULE_FOLLOW_GATE_BUTTON_TEXT,
  RULE_FOLLOW_GATE_CONSENT_MESSAGE,
  RULE_FOLLOW_UP_DELAY_MS,
  RULE_INVALID_EMAIL_PROMPT,
} from "./ruleShared";

type RuleAutomation = Doc<"automationRules">;
type WebUrlButton = Extract<AutomatedButton, { type: "web_url" }>;
type RuleAutomationLike = Pick<
  RuleAutomation,
  | "triggerType"
  | "keywords"
  | "replyText"
  | "linkDmText"
  | "linkButtons"
  | "followUpEnabled"
>;

type StartSessionArgs = {
  workspaceId: Id<"workspaces">;
  instagramAccountId: Id<"instagramAccounts">;
  automationRuleId: Id<"automationRules">;
  contactId: Id<"contacts">;
  conversationId: Id<"conversations">;
  matchedAt: number;
};

type AdvanceSessionInput = {
  hasMessage: boolean;
  text: string | null;
  postbackPayload: string | null;
  quickReplyPayload: string | null;
};

type FollowGateCheckStatus = "following" | "not_following" | "consent_required";
type FollowGateInputMode = "button" | "reply";

const RULE_AUTOMATION_SESSION_MESSAGE_LIMIT = 8;
const FOLLOW_GATE_POSTBACK_PAYLOAD = "rule_automation:follow_gate";

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
  session: Pick<Doc<"automationRuleSessions">, "followGateInputMode">,
  inbound: AdvanceSessionInput,
) {
  const inputMode = session.followGateInputMode ?? "button";

  if (inputMode === "button") {
    return inbound.postbackPayload === FOLLOW_GATE_POSTBACK_PAYLOAD;
  }

  return hasInboundInteraction(inbound);
}

function isTerminalSessionStep(
  step: Doc<"automationRuleSessions">["currentStep"],
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
    return `Safety guardrail stopped this DM automation after ${args.limit} outbound DM${suffix} in the same session while sending ${args.purpose}.`;
  }

  return `Safety guardrail stopped this DM automation after ${args.limit} outbound DM${suffix} in the same conversation within ${formatGuardrailWindowLabel(args.windowMs ?? AUTOMATION_CONVERSATION_BURST_WINDOW_MS)} while sending ${args.purpose}.`;
}

function getRuleAutomationValidationIssues(
  automation: RuleAutomationLike,
) {
  return getAutomationRuleValidationIssues({
    triggerType: automation.triggerType,
    keywords: automation.keywords,
    replyText: automation.replyText,
    linkDmText: automation.linkDmText,
    linkButtons: automation.linkButtons ?? [],
    followUpEnabled: automation.followUpEnabled ?? false,
  });
}

async function tripRuleAutomationGuardrail(
  ctx: MutationCtx,
  args: {
    session: Doc<"automationRuleSessions">;
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
}

async function queueGuardedRuleAutomationTextReply(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"automationRuleSessions">;
    automation: RuleAutomation;
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
    !args.automation.isActive
  ) {
    return false;
  }

  const sessionOutboundCount = session.outboundMessageCount ?? 0;
  if (sessionOutboundCount + 1 > RULE_AUTOMATION_SESSION_MESSAGE_LIMIT) {
    await tripRuleAutomationGuardrail(ctx, {
      session,
      reason: buildGuardrailReason({
        limitType: "session",
        limit: RULE_AUTOMATION_SESSION_MESSAGE_LIMIT,
        purpose: args.purpose,
      }),
    });
    return false;
  }

  const conversationOutboundCount =
    await getRecentConversationOutboundAttemptCount(
      ctx,
      session.conversationId,
    );
  if (
    conversationOutboundCount + 1 >
    AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT
  ) {
    await tripRuleAutomationGuardrail(ctx, {
      session,
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
    automationRuleId: session.automationRuleId,
    sequenceEnrollmentId: null,
  });

  await ctx.db.patch(session._id, {
    outboundMessageCount: sessionOutboundCount + 1,
    lastStepAt: Date.now(),
  });

  return true;
}

async function queueGuardedRuleAutomationButtonTemplate(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"automationRuleSessions">;
    automation: RuleAutomation;
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
    !args.automation.isActive
  ) {
    return false;
  }

  const sessionOutboundCount = session.outboundMessageCount ?? 0;
  if (sessionOutboundCount + 1 > RULE_AUTOMATION_SESSION_MESSAGE_LIMIT) {
    await tripRuleAutomationGuardrail(ctx, {
      session,
      reason: buildGuardrailReason({
        limitType: "session",
        limit: RULE_AUTOMATION_SESSION_MESSAGE_LIMIT,
        purpose: args.purpose,
      }),
    });
    return false;
  }

  const conversationOutboundCount =
    await getRecentConversationOutboundAttemptCount(
      ctx,
      session.conversationId,
    );
  if (
    conversationOutboundCount + 1 >
    AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT
  ) {
    await tripRuleAutomationGuardrail(ctx, {
      session,
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
    automationRuleId: session.automationRuleId,
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
  automation: Pick<RuleAutomation, "linkButtons">,
): WebUrlButton[] {
  if (!automation.linkButtons || automation.linkButtons.length === 0) {
    return [];
  }

  return automation.linkButtons.map((button) => ({
    type: "web_url" as const,
    title: button.label.trim(),
    url: button.url.trim(),
  }));
}

async function getLatestSessionsForRuleAutomation(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  automationRuleId: Id<"automationRules">,
) {
  return await ctx.db
    .query("automationRuleSessions")
    .withIndex("by_contact_id_and_automation_rule_id", (q) =>
      q.eq("contactId", contactId).eq("automationRuleId", automationRuleId),
    )
    .order("desc")
    .take(10);
}

export async function startRuleAutomationSession(
  ctx: MutationCtx,
  automation: RuleAutomation,
  args: StartSessionArgs,
) {
  if (getRuleAutomationValidationIssues(automation).length > 0) {
    return null;
  }

  const existingSessions = await getLatestSessionsForRuleAutomation(
    ctx,
    args.contactId,
    args.automationRuleId,
  );
  const activeSession = existingSessions.find(
    (session) => !isTerminalSessionStep(session.currentStep),
  );

  if (activeSession) {
    return null;
  }

  let firstStep: Doc<"automationRuleSessions">["currentStep"];
  if (automation.followGateEnabled ?? false) {
    firstStep = "follow_gate_sent";
  } else if (
    automation.emailCollectionEnabled &&
    (automation.emailCollectionText ?? "").trim()
  ) {
    firstStep = "email_requested";
  } else {
    firstStep = "link_sent";
  }

  const sessionId = await ctx.db.insert("automationRuleSessions", {
    workspaceId: args.workspaceId,
    automationRuleId: args.automationRuleId,
    contactId: args.contactId,
    conversationId: args.conversationId,
    instagramAccountId: args.instagramAccountId,
    currentStep: firstStep,
    collectedEmail: null,
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
  });

  await ctx.runMutation(internal.contacts.upsertContactAutomationMembership, {
    workspaceId: args.workspaceId,
    contactId: args.contactId,
    conversationId: args.conversationId,
    automationKind: "rule",
    automationRuleId: args.automationRuleId,
    commentAutomationId: null,
    storyAutomationId: null,
    sequenceDefinitionId: null,
    matchedAt: args.matchedAt,
  });

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
    await queueGuardedRuleAutomationTextReply(ctx, {
      sessionId,
      automation,
      messageText: automation.emailCollectionText ?? "",
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

export async function advanceRuleAutomationSession(
  ctx: MutationCtx,
  sessionId: Id<"automationRuleSessions">,
  inbound: AdvanceSessionInput,
) {
  const session = await ctx.db.get(sessionId);
  if (!session || isTerminalSessionStep(session.currentStep)) {
    return null;
  }

  const automation = await ctx.db.get(session.automationRuleId);
  if (!automation || getRuleAutomationValidationIssues(automation).length > 0) {
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
        await queueGuardedRuleAutomationTextReply(ctx, {
          sessionId,
          automation,
          messageText: RULE_INVALID_EMAIL_PROMPT,
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
        automationKind: "rule",
        automationRuleId: automation._id,
        commentAutomationId: null,
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
    session: Doc<"automationRuleSessions">;
    automation: RuleAutomation;
  },
) {
  const now = Date.now();

  if (
    args.automation.emailCollectionEnabled &&
    (args.automation.emailCollectionText ?? "").trim()
  ) {
    await queueGuardedRuleAutomationTextReply(ctx, {
      sessionId: args.session._id,
      automation: args.automation,
      messageText: args.automation.emailCollectionText ?? "",
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
  automation: Pick<RuleAutomation, "followGateText">,
  consentRequired: boolean,
) {
  const baseMessage =
    automation.followGateText?.trim() || RULE_DEFAULT_FOLLOW_GATE_MESSAGE;

  if (!consentRequired) {
    return baseMessage;
  }

  return `${baseMessage}\n\n${RULE_FOLLOW_GATE_CONSENT_MESSAGE}`;
}

async function sendFollowGate(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"automationRuleSessions">;
    automation: RuleAutomation;
    consentRequired: boolean;
  },
) {
  const messageText = getFollowGateMessage(
    args.automation,
    args.consentRequired,
  );

  if (args.consentRequired) {
    return await queueGuardedRuleAutomationTextReply(ctx, {
      sessionId: args.sessionId,
      automation: args.automation,
      messageText,
      purpose: "the follow gate prompt",
    });
  }

  return await queueGuardedRuleAutomationButtonTemplate(ctx, {
    sessionId: args.sessionId,
    automation: args.automation,
    messageText,
    buttons: [
      {
        type: "postback",
        title: RULE_FOLLOW_GATE_BUTTON_TEXT,
        payload: FOLLOW_GATE_POSTBACK_PAYLOAD,
      },
    ],
    purpose: "the follow gate prompt",
  });
}

async function sendLinkDm(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"automationRuleSessions">;
    automation: RuleAutomation;
  },
) {
  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    return;
  }

  const messageText =
    getEffectiveRuleLinkDmText({
      replyText: args.automation.replyText,
      linkDmText: args.automation.linkDmText,
      hasLinkButtons: getLinkButtons(args.automation).length > 0,
    }) || RULE_DEFAULT_LINK_MESSAGE;
  const rawLinkButtons = getLinkButtons(args.automation);
  const trackedButtons: WebUrlButton[] = [];

  if (rawLinkButtons.length > 0) {
    const siteUrl = requireSiteUrl();
    const createdAt = Date.now();

    for (const [buttonIndex, button] of rawLinkButtons.entries()) {
      const token = crypto.randomUUID();
      await ctx.db.insert("automationRuleTrackedLinks", {
        workspaceId: session.workspaceId,
        instagramAccountId: session.instagramAccountId,
        automationRuleId: session.automationRuleId,
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
        url: new URL(`/api/rule-automation/links/${token}`, siteUrl).toString(),
      });
    }
  }

  if (trackedButtons.length > 0) {
    const buttonBatches = chunkButtons(trackedButtons, 3);

    for (const [index, buttons] of buttonBatches.entries()) {
      const queued = await queueGuardedRuleAutomationButtonTemplate(ctx, {
        sessionId: session._id,
        automation: args.automation,
        messageText: index === 0 ? messageText : RULE_DEFAULT_LINK_BATCH_MESSAGE,
        buttons,
        purpose: "the link delivery",
      });
      if (!queued) {
        return;
      }
    }
  } else {
    const queued = await queueGuardedRuleAutomationTextReply(ctx, {
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
  const nextPatch: Partial<Doc<"automationRuleSessions">> = {
    currentStep: "completed",
    lastStepAt: now,
    followGateInputMode: null,
    linkSentAt: now,
  };

  if (
    args.automation.followUpEnabled &&
    (args.automation.followUpText ?? "").trim() &&
    trackedButtons.length > 0 &&
    (session.followUpScheduledAt ?? null) === null
  ) {
    nextPatch.followUpScheduledAt = now + RULE_FOLLOW_UP_DELAY_MS;

    await ctx.scheduler.runAfter(
      RULE_FOLLOW_UP_DELAY_MS,
      internal.automations.ruleFlow.processScheduledFollowUp,
      { sessionId: session._id },
    );
  }

  await ctx.db.patch(session._id, nextPatch);
}

export const processScheduledFollowUp = internalMutation({
  args: { sessionId: v.id("automationRuleSessions") },
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

    const automation = await ctx.db.get(session.automationRuleId);
    const conversation = await ctx.db.get(session.conversationId);

    if (
      automation === null ||
      conversation === null ||
      !automation.isActive ||
      !automation.followUpEnabled ||
      !(automation.followUpText ?? "").trim() ||
      getRuleAutomationValidationIssues(automation).length > 0
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

    const queued = await queueGuardedRuleAutomationTextReply(ctx, {
      sessionId: session._id,
      automation,
      messageText: automation.followUpText ?? "",
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

export const advanceRuleAutomationSessionInternal = internalMutation({
  args: {
    sessionId: v.id("automationRuleSessions"),
    hasMessage: v.boolean(),
    text: v.union(v.string(), v.null()),
    postbackPayload: v.union(v.string(), v.null()),
    quickReplyPayload: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    return await advanceRuleAutomationSession(ctx, args.sessionId, {
      hasMessage: args.hasMessage,
      text: args.text,
      postbackPayload: args.postbackPayload,
      quickReplyPayload: args.quickReplyPayload,
    });
  },
});

export const getRuleAutomationSessionActionContext = internalQuery({
  args: { sessionId: v.id("automationRuleSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      return null;
    }

    const automation = await ctx.db.get(session.automationRuleId);
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
    sessionId: v.id("automationRuleSessions"),
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

    const automation = await ctx.db.get(session.automationRuleId);
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

export const processInboundRuleAutomationInteraction = internalAction({
  args: {
    sessionId: v.id("automationRuleSessions"),
    hasMessage: v.boolean(),
    text: v.union(v.string(), v.null()),
    postbackPayload: v.union(v.string(), v.null()),
    quickReplyPayload: v.union(v.string(), v.null()),
    deliveryKey: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.automations.ruleFlow.getRuleAutomationSessionActionContext,
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
        internal.automations.ruleFlow.advanceRuleAutomationSessionInternal,
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

    await ctx.runMutation(internal.automations.ruleFlow.handleFollowGateCheckResult, {
      sessionId: session._id,
      deliveryKey: args.deliveryKey,
      status: followStatus,
    });

    return null;
  },
});
