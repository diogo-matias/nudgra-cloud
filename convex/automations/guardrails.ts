import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export const AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT = 30;
export const AUTOMATION_CONVERSATION_BURST_WINDOW_MS = 15 * 60 * 1000;

const MAX_RECENT_CONVERSATION_ATTEMPTS =
  AUTOMATION_CONVERSATION_BURST_MESSAGE_LIMIT * 4;

export type ConversationGuardrailAutomationType =
  | "comment_automation"
  | "rule"
  | "story_automation"
  | "sequence";

type GuardrailAttempt = Pick<
  Doc<"deliveryAttempts">,
  "automationRuleId" | "storyAutomationId" | "sequenceEnrollmentId" | "status"
>;

function isDeliveryAttemptStatusCountedForConversationGuardrail(
  status: GuardrailAttempt["status"],
) {
  return status === "queued" || status === "sent" || status === "failed";
}

export function getDeliveryAttemptAutomationType(
  attempt: Pick<
    GuardrailAttempt,
    "automationRuleId" | "storyAutomationId" | "sequenceEnrollmentId"
  >,
): ConversationGuardrailAutomationType {
  if (attempt.sequenceEnrollmentId !== null) {
    return "sequence";
  }

  if ((attempt.storyAutomationId ?? null) !== null) {
    return "story_automation";
  }

  if (attempt.automationRuleId !== null) {
    return "rule";
  }

  return "comment_automation";
}

export function shouldCountDeliveryAttemptForConversationGuardrail(args: {
  attempt: GuardrailAttempt;
  automationType: ConversationGuardrailAutomationType;
}) {
  return (
    isDeliveryAttemptStatusCountedForConversationGuardrail(args.attempt.status) &&
    getDeliveryAttemptAutomationType(args.attempt) === args.automationType
  );
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
  automationType: ConversationGuardrailAutomationType,
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
      (shouldCountDeliveryAttemptForConversationGuardrail({
        attempt,
        automationType,
      })
        ? 1
        : 0),
    0,
  );
}
