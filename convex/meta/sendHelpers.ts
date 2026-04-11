import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { canUseAccountToken } from "./authShared";

export type AutomatedQuickReply = {
  content_type: "text";
  title: string;
  payload: string;
};

export type AutomatedButton =
  | {
      type: "web_url";
      title: string;
      url: string;
    }
  | {
      type: "postback";
      title: string;
      payload: string;
    };

export type AutomatedMessageDescriptor =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "quick_reply";
      text: string;
      quickReplies: AutomatedQuickReply[];
    }
  | {
      kind: "button_template";
      text: string;
      buttons: AutomatedButton[];
    };

type QueueAutomatedBaseArgs = {
  workspaceId: Id<"workspaces">;
  instagramAccountId: Id<"instagramAccounts">;
  conversationId: Id<"conversations">;
  contactId: Id<"contacts">;
  automationRuleId: Id<"automationRules"> | null;
  sequenceEnrollmentId: Id<"sequenceEnrollments"> | null;
};

type QueueAutomatedMessageArgs = QueueAutomatedBaseArgs & {
  messageText: string;
  requestDescriptor: AutomatedMessageDescriptor;
};

type QueueAutomatedQuickReplyArgs = QueueAutomatedBaseArgs & {
  messageText: string;
  quickReplies: AutomatedQuickReply[];
};

type QueueAutomatedButtonTemplateArgs = QueueAutomatedBaseArgs & {
  messageText: string;
  buttons: AutomatedButton[];
};

function buildDeliveryPreview(text: string, actions: string[]) {
  const normalizedText = text.trim();
  const parts = normalizedText ? [normalizedText] : [];
  return [...parts, ...actions].join("\n");
}

async function queueAutomatedMessage(
  ctx: MutationCtx,
  args: QueueAutomatedMessageArgs,
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
  const tokenExpired =
    account.tokenExpiresAt !== null && account.tokenExpiresAt <= now;
  const accountTokenUsable = canUseAccountToken({
    status: account.status,
    graphAccessToken: account.graphAccessToken,
    reconnectRequired: account.reconnectRequired ?? false,
  });

  const status = !policyWindowOpen
    ? "skipped_expired"
    : account.status === "disconnected"
      ? "skipped"
      : !accountTokenUsable || tokenExpired
        ? "blocked_auth"
        : "queued";

  const reason =
    status === "queued"
      ? null
      : !policyWindowOpen
        ? "24-hour messaging window expired."
        : status === "skipped"
          ? "Instagram account was disconnected before the delivery could be sent."
          : "Outbound sending is paused until Instagram token access recovers.";

  const deliveryAttemptId = await ctx.db.insert("deliveryAttempts", {
    workspaceId: args.workspaceId,
    instagramAccountId: args.instagramAccountId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    automationRuleId: args.automationRuleId,
    sequenceEnrollmentId: args.sequenceEnrollmentId,
    status,
    reason,
    requestPayload: JSON.stringify(args.requestDescriptor),
    responsePayload: null,
    policyWindowOpen,
    attemptNumber: 1,
    eventTime: now,
    messageText: args.messageText,
    metaMessageId: null,
  });

  if (status === "queued") {
    await ctx.scheduler.runAfter(
      0,
      internal.meta.sendActions.performQueuedDelivery,
      {
        deliveryAttemptId,
      },
    );
  } else if (
    status === "blocked_auth" &&
    tokenExpired &&
    account.graphAccessToken
  ) {
    await ctx.scheduler.runAfter(
      0,
      internal.meta.tokenLifecycle.refreshAccountToken,
      {
        accountId: account._id,
        reason: "scheduled",
      },
    );
  } else if (status === "skipped_expired") {
    await ctx.db.patch(args.conversationId, {
      status: "window_closed",
    });
  }

  return { deliveryAttemptId, status };
}

export async function queueAutomatedTextReply(
  ctx: MutationCtx,
  args: QueueAutomatedBaseArgs & { messageText: string },
) {
  const messageText = args.messageText.trim();

  return queueAutomatedMessage(ctx, {
    ...args,
    messageText,
    requestDescriptor: {
      kind: "text",
      text: messageText,
    },
  });
}

export async function queueAutomatedQuickReply(
  ctx: MutationCtx,
  args: QueueAutomatedQuickReplyArgs,
) {
  const messageText = args.messageText.trim();
  const quickReplies = args.quickReplies
    .map((reply) => ({
      content_type: "text" as const,
      title: reply.title.trim(),
      payload: reply.payload.trim(),
    }))
    .filter((reply) => reply.title.length > 0 && reply.payload.length > 0)
    .slice(0, 13);

  if (quickReplies.length === 0) {
    return queueAutomatedTextReply(ctx, {
      ...args,
      messageText,
    });
  }

  return queueAutomatedMessage(ctx, {
    ...args,
    messageText: buildDeliveryPreview(
      messageText,
      quickReplies.map((reply) => `[${reply.title}]`),
    ),
    requestDescriptor: {
      kind: "quick_reply",
      text: messageText,
      quickReplies,
    },
  });
}

export async function queueAutomatedButtonTemplate(
  ctx: MutationCtx,
  args: QueueAutomatedButtonTemplateArgs,
) {
  const messageText = args.messageText.trim();
  const buttons = args.buttons
    .map((button) =>
      button.type === "web_url"
        ? {
            type: "web_url" as const,
            title: button.title.trim(),
            url: button.url.trim(),
          }
        : {
            type: "postback" as const,
            title: button.title.trim(),
            payload: button.payload.trim(),
          },
    )
    .filter((button) =>
      button.type === "web_url"
        ? button.title.length > 0 && button.url.length > 0
        : button.title.length > 0 && button.payload.length > 0,
    )
    .slice(0, 3);

  if (buttons.length === 0) {
    return queueAutomatedTextReply(ctx, {
      ...args,
      messageText,
    });
  }

  return queueAutomatedMessage(ctx, {
    ...args,
    messageText: buildDeliveryPreview(
      messageText,
      buttons.map((button) =>
        button.type === "web_url"
          ? `[${button.title}] ${button.url}`
          : `[${button.title}]`,
      ),
    ),
    requestDescriptor: {
      kind: "button_template",
      text: messageText,
      buttons,
    },
  });
}
