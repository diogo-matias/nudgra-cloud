import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import {
  type AutomatedButton,
  queueAutomatedButtonTemplate,
  queueAutomatedTextReply,
} from "../meta/sendHelpers";

type CommentAutomation = Doc<"commentAutomations">;

type StartSessionArgs = {
  workspaceId: Id<"workspaces">;
  instagramAccountId: Id<"instagramAccounts">;
  commentAutomationId: Id<"commentAutomations">;
  contactId: Id<"contacts">;
  conversationId: Id<"conversations">;
  commentId: string | null;
  mediaId: string | null;
};

const FOLLOW_GATE_CONFIRM_BUTTON_TEXT = "I'm following";
const DEFAULT_LINK_BUTTON_TEXT = "Open link";
const DEFAULT_LINK_MESSAGE = "Tap below to open your link.";
const DEFAULT_LINK_BATCH_MESSAGE = "More links";
const OPENING_DM_POSTBACK_PAYLOAD = "comment_automation:opening_dm";
const FOLLOW_GATE_POSTBACK_PAYLOAD = "comment_automation:follow_gate";

function chunkButtons(buttons: AutomatedButton[], size: number) {
  const chunks: AutomatedButton[][] = [];

  for (let index = 0; index < buttons.length; index += size) {
    chunks.push(buttons.slice(index, index + size));
  }

  return chunks;
}

function getLinkButtons(automation: CommentAutomation): AutomatedButton[] {
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

async function getLatestSessionsForContactAutomation(
  ctx: MutationCtx,
  contactId: Id<"contacts">,
  commentAutomationId: Id<"commentAutomations">,
) {
  return await ctx.db
    .query("commentAutomationSessions")
    .withIndex("by_contact_id_and_comment_automation_id", (q) =>
      q.eq("contactId", contactId).eq("commentAutomationId", commentAutomationId),
    )
    .order("desc")
    .take(10);
}

export async function startCommentAutomationSession(
  ctx: MutationCtx,
  automation: CommentAutomation,
  args: StartSessionArgs,
) {
  const now = Date.now();

  const existingSessions = await getLatestSessionsForContactAutomation(
    ctx,
    args.contactId,
    args.commentAutomationId,
  );
  const activeSession = existingSessions.find(
    (session) => session.currentStep !== "completed",
  );

  if (activeSession) {
    return null;
  }

  let firstStep: Doc<"commentAutomationSessions">["currentStep"];

  if (automation.openingDmEnabled && automation.openingDmText.trim()) {
    firstStep = "opening_dm_sent";
  } else if (automation.followGateEnabled && automation.followGateText.trim()) {
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
  });

  if (firstStep === "opening_dm_sent") {
    await sendOpeningDm(ctx, {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      automation,
    });

    await ctx.db.patch(sessionId, {
      currentStep: "awaiting_button_click",
      lastStepAt: Date.now(),
    });
  } else if (firstStep === "follow_gate_sent") {
    await sendFollowGate(ctx, {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      automation,
    });

    await ctx.db.patch(sessionId, {
      currentStep: "awaiting_follow",
      lastStepAt: Date.now(),
    });
  } else if (firstStep === "email_requested") {
    await queueAutomatedTextReply(ctx, {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      messageText: automation.emailCollectionText,
      automationRuleId: null,
      sequenceEnrollmentId: null,
    });

    await ctx.db.patch(sessionId, {
      currentStep: "awaiting_email",
      lastStepAt: Date.now(),
    });
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
  inboundText: string | null,
) {
  const session = await ctx.db.get(sessionId);
  if (
    !session ||
    session.currentStep === "completed" ||
    session.currentStep === "link_sent"
  ) {
    return null;
  }

  const automation = await ctx.db.get(session.commentAutomationId);
  if (!automation) {
    return null;
  }

  const now = Date.now();

  switch (session.currentStep) {
    case "awaiting_button_click":
    case "opening_dm_sent": {
      if (automation.followGateEnabled && automation.followGateText.trim()) {
        await sendFollowGate(ctx, {
          workspaceId: session.workspaceId,
          instagramAccountId: session.instagramAccountId,
          conversationId: session.conversationId,
          contactId: session.contactId,
          automation,
        });
        await ctx.db.patch(sessionId, {
          currentStep: "awaiting_follow",
          lastStepAt: now,
        });
      } else if (
        automation.emailCollectionEnabled &&
        automation.emailCollectionText.trim()
      ) {
        await queueAutomatedTextReply(ctx, {
          workspaceId: session.workspaceId,
          instagramAccountId: session.instagramAccountId,
          conversationId: session.conversationId,
          contactId: session.contactId,
          messageText: automation.emailCollectionText,
          automationRuleId: null,
          sequenceEnrollmentId: null,
        });
        await ctx.db.patch(sessionId, {
          currentStep: "awaiting_email",
          lastStepAt: now,
        });
      } else {
        await sendLinkDm(ctx, { sessionId, automation });
      }
      break;
    }

    case "follow_gate_sent":
    case "awaiting_follow": {
      if (
        automation.emailCollectionEnabled &&
        automation.emailCollectionText.trim()
      ) {
        await queueAutomatedTextReply(ctx, {
          workspaceId: session.workspaceId,
          instagramAccountId: session.instagramAccountId,
          conversationId: session.conversationId,
          contactId: session.contactId,
          messageText: automation.emailCollectionText,
          automationRuleId: null,
          sequenceEnrollmentId: null,
        });
        await ctx.db.patch(sessionId, {
          currentStep: "awaiting_email",
          lastStepAt: now,
        });
      } else {
        await sendLinkDm(ctx, { sessionId, automation });
      }
      break;
    }

    case "email_requested":
    case "awaiting_email": {
      const email = extractEmail(inboundText);
      await ctx.db.patch(sessionId, {
        collectedEmail: email,
        lastStepAt: now,
      });

      await sendLinkDm(ctx, { sessionId, automation });
      break;
    }

    default:
      break;
  }

  return session.currentStep;
}

async function sendOpeningDm(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    conversationId: Id<"conversations">;
    contactId: Id<"contacts">;
    automation: CommentAutomation;
  },
) {
  const buttonTitle = args.automation.openingDmButtonText.trim();

  if (!buttonTitle) {
    await queueAutomatedTextReply(ctx, {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      messageText: args.automation.openingDmText,
      automationRuleId: null,
      sequenceEnrollmentId: null,
    });
    return;
  }

  await queueAutomatedButtonTemplate(ctx, {
    workspaceId: args.workspaceId,
    instagramAccountId: args.instagramAccountId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    messageText: args.automation.openingDmText,
    buttons: [
      {
        type: "postback",
        title: buttonTitle,
        payload: OPENING_DM_POSTBACK_PAYLOAD,
      },
    ],
    automationRuleId: null,
    sequenceEnrollmentId: null,
  });
}

async function sendFollowGate(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    conversationId: Id<"conversations">;
    contactId: Id<"contacts">;
    automation: CommentAutomation;
  },
) {
  await queueAutomatedButtonTemplate(ctx, {
    workspaceId: args.workspaceId,
    instagramAccountId: args.instagramAccountId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    messageText: args.automation.followGateText,
    buttons: [
      {
        type: "postback",
        title: FOLLOW_GATE_CONFIRM_BUTTON_TEXT,
        payload: FOLLOW_GATE_POSTBACK_PAYLOAD,
      },
    ],
    automationRuleId: null,
    sequenceEnrollmentId: null,
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
  const linkButtons = getLinkButtons(args.automation);

  if (linkButtons.length > 0) {
    const buttonBatches = chunkButtons(linkButtons, 3);

    for (const [index, buttons] of buttonBatches.entries()) {
      await queueAutomatedButtonTemplate(ctx, {
        workspaceId: session.workspaceId,
        instagramAccountId: session.instagramAccountId,
        conversationId: session.conversationId,
        contactId: session.contactId,
        messageText: index === 0 ? messageText : DEFAULT_LINK_BATCH_MESSAGE,
        buttons,
        automationRuleId: null,
        sequenceEnrollmentId: null,
      });
    }
  } else {
    await queueAutomatedTextReply(ctx, {
      workspaceId: session.workspaceId,
      instagramAccountId: session.instagramAccountId,
      conversationId: session.conversationId,
      contactId: session.contactId,
      messageText,
      automationRuleId: null,
      sequenceEnrollmentId: null,
    });
  }

  await ctx.db.patch(session._id, {
    currentStep: "completed",
    lastStepAt: Date.now(),
  });
}

function extractEmail(text: string | null): string | null {
  if (!text) {
    return null;
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

export function matchesCommentAutomation(args: {
  automation: CommentAutomation;
  mediaId: string;
  commentText: string | null;
}) {
  if (args.automation.postScope === "specific") {
    if (!args.automation.selectedMediaIds.includes(args.mediaId)) {
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
