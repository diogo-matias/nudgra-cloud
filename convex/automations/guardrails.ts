import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export const AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT = 30;
export const AUTOMATION_CONVERSATION_BURST_WINDOW_MS = 15 * 60 * 1000;

const MAX_RECENT_CONVERSATION_ATTEMPTS =
  AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT * 4;

export function shouldCountDeliveryAttemptForConversationGuardrail(
  status: Doc<"deliveryAttempts">["status"],
) {
  return status === "queued" || status === "sent" || status === "failed";
}

export function formatGuardrailWindowLabel(windowMs: number) {
  const minutes = Math.max(1, Math.round(windowMs / (60 * 1000)));

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export async function getRecentConversationOutboundAttemptCount(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
) {
  const windowStart = Date.now() - AUTOMATION_CONVERSATION_BURST_WINDOW_MS;
  const recentAttempts = await ctx.db
    .query("deliveryAttempts")
    .withIndex("by_conversation_id_and_event_time", (q) =>
      q.eq("conversationId", conversationId).gte("eventTime", windowStart),
    )
    .order("desc")
    .take(MAX_RECENT_CONVERSATION_ATTEMPTS);

  return recentAttempts.reduce(
    (total, attempt) =>
      total +
      (shouldCountDeliveryAttemptForConversationGuardrail(attempt.status)
        ? 1
        : 0),
    0,
  );
}
