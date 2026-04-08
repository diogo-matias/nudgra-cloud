import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { queueAutomatedTextReply } from "../meta/sendHelpers";

// ── Types ────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────

function pickRandomCommentReply(texts: string[]) {
  if (texts.length === 0) return null;
  return texts[Math.floor(Math.random() * texts.length)];
}

// ── Start a new comment automation session ───────────────────────

export async function startCommentAutomationSession(
  ctx: MutationCtx,
  automation: CommentAutomation,
  args: StartSessionArgs,
) {
  const now = Date.now();

  // Check if there's already an active session for this contact + automation
  const existingSession = await ctx.db
    .query("commentAutomationSessions")
    .withIndex("by_contact_id_and_comment_automation_id", (q) =>
      q
        .eq("contactId", args.contactId)
        .eq("commentAutomationId", args.commentAutomationId),
    )
    .unique();

  if (existingSession && existingSession.currentStep !== "completed") {
    // Already has an active session, don't start a new one
    return null;
  }

  // Determine the first step based on what's enabled
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

  // Send the first DM
  if (firstStep === "opening_dm_sent") {
    // Build the opening DM text with the button label appended as a prompt
    const dmText = automation.openingDmText;
    await queueAutomatedTextReply(ctx, {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      messageText: dmText,
      automationRuleId: null,
      sequenceEnrollmentId: null,
    });

    // Update session to awaiting button click
    await ctx.db.patch(sessionId, {
      currentStep: "awaiting_button_click",
      lastStepAt: Date.now(),
    });
  } else if (firstStep === "follow_gate_sent") {
    await queueAutomatedTextReply(ctx, {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      messageText: automation.followGateText,
      automationRuleId: null,
      sequenceEnrollmentId: null,
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
    // Send link directly
    const linkMessage = automation.linkUrl
      ? `${automation.linkDmText}\n\n${automation.linkUrl}`
      : automation.linkDmText;

    await queueAutomatedTextReply(ctx, {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      messageText: linkMessage,
      automationRuleId: null,
      sequenceEnrollmentId: null,
    });

    await ctx.db.patch(sessionId, {
      currentStep: "completed",
      lastStepAt: Date.now(),
    });
  }

  // Update trigger count
  await ctx.db.patch(automation._id, {
    triggerCount: automation.triggerCount + 1,
    lastTriggeredAt: now,
  });

  return sessionId;
}

// ── Advance session on inbound DM ────────────────────────────────

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
  if (!automation) return null;

  const now = Date.now();

  switch (session.currentStep) {
    case "awaiting_button_click":
    case "opening_dm_sent": {
      // User responded to the opening DM (clicked the button / replied)
      // Next: follow gate or email or link
      if (automation.followGateEnabled && automation.followGateText.trim()) {
        await queueAutomatedTextReply(ctx, {
          workspaceId: session.workspaceId,
          instagramAccountId: session.instagramAccountId,
          conversationId: session.conversationId,
          contactId: session.contactId,
          messageText: automation.followGateText,
          automationRuleId: null,
          sequenceEnrollmentId: null,
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
        // Send link directly
        await sendLinkDm(ctx, session, automation);
      }
      break;
    }

    case "follow_gate_sent":
    case "awaiting_follow": {
      // User responded after follow gate prompt
      // In real implementation, we'd check follower status via API
      // For now, any response advances to next step
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
        await sendLinkDm(ctx, session, automation);
      }
      break;
    }

    case "email_requested":
    case "awaiting_email": {
      // User responded with their email
      const email = extractEmail(inboundText);
      await ctx.db.patch(sessionId, {
        collectedEmail: email,
        lastStepAt: now,
      });

      // Send the link regardless
      await sendLinkDm(ctx, session, automation);
      break;
    }

    default:
      break;
  }

  return session.currentStep;
}

// ── Helpers ──────────────────────────────────────────────────────

async function sendLinkDm(
  ctx: MutationCtx,
  session: Doc<"commentAutomationSessions">,
  automation: Doc<"commentAutomations">,
) {
  const linkMessage = automation.linkUrl
    ? `${automation.linkDmText}\n\n${automation.linkUrl}`
    : automation.linkDmText;

  await queueAutomatedTextReply(ctx, {
    workspaceId: session.workspaceId,
    instagramAccountId: session.instagramAccountId,
    conversationId: session.conversationId,
    contactId: session.contactId,
    messageText: linkMessage,
    automationRuleId: null,
    sequenceEnrollmentId: null,
  });

  await ctx.db.patch(session._id, {
    currentStep: "completed",
    lastStepAt: Date.now(),
  });
}

function extractEmail(text: string | null): string | null {
  if (!text) return null;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

// ── Match a comment against active comment automations ───────────

export function matchesCommentAutomation(args: {
  automation: CommentAutomation;
  mediaId: string;
  commentText: string | null;
}) {
  // Check media scope
  if (args.automation.postScope === "specific") {
    if (!args.automation.selectedMediaIds.includes(args.mediaId)) {
      return false;
    }
  }
  // "any" and "next" scopes match any post

  // Check comment text
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
