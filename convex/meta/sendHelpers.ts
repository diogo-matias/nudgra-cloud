import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

type QueueAutomatedTextReplyArgs = {
  workspaceId: Id<"workspaces">;
  instagramAccountId: Id<"instagramAccounts">;
  conversationId: Id<"conversations">;
  contactId: Id<"contacts">;
  messageText: string;
  automationRuleId: Id<"automationRules"> | null;
  sequenceEnrollmentId: Id<"sequenceEnrollments"> | null;
};

export async function queueAutomatedTextReply(
  ctx: MutationCtx,
  args: QueueAutomatedTextReplyArgs,
) {
  const conversation = await ctx.db.get(args.conversationId);
  const account = await ctx.db.get(args.instagramAccountId);

  if (conversation === null || account === null) {
    throw new Error("Missing delivery context for queued message.");
  }

  const now = Date.now();
  const policyWindowOpen =
    conversation.messagingWindowClosesAt !== null &&
    conversation.messagingWindowClosesAt >= now;

  const status =
    !policyWindowOpen || account.status !== "connected" || !account.graphAccessToken
      ? account.status === "connected" && account.graphAccessToken
        ? "skipped"
        : "failed"
      : "queued";

  const reason =
    status === "queued"
      ? null
      : !policyWindowOpen
        ? "24-hour messaging window expired."
        : "Connected Instagram account is unavailable.";

  const deliveryAttemptId = await ctx.db.insert("deliveryAttempts", {
    workspaceId: args.workspaceId,
    instagramAccountId: args.instagramAccountId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    automationRuleId: args.automationRuleId,
    sequenceEnrollmentId: args.sequenceEnrollmentId,
    status,
    reason,
    requestPayload: JSON.stringify({
      recipientContactId: args.contactId,
      text: args.messageText,
    }),
    responsePayload: null,
    policyWindowOpen,
    attemptNumber: 1,
    eventTime: now,
    messageText: args.messageText,
    metaMessageId: null,
  });

  if (status === "queued") {
    await ctx.scheduler.runAfter(0, internal.meta.sendActions.performQueuedDelivery, {
      deliveryAttemptId,
    });
  } else if (status === "skipped") {
    await ctx.db.patch(args.conversationId, {
      status: "window_closed",
    });
  }

  return { deliveryAttemptId, status };
}
