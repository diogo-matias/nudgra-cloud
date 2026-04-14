import { Doc } from "../_generated/dataModel";

export type DeliveryKind = "response_dm" | "private_reply";

type DeliveryAttemptPolicyLike = Pick<
  Doc<"deliveryAttempts">,
  "deliveryKind" | "privateReplyExpiresAt"
>;

type ConversationPolicyLike = {
  messagingWindowClosesAt: number | null;
};

export function getDeliveryKind(attempt: DeliveryAttemptPolicyLike): DeliveryKind {
  return attempt.deliveryKind ?? "response_dm";
}

export function isPrivateReplyDelivery(attempt: DeliveryAttemptPolicyLike) {
  return getDeliveryKind(attempt) === "private_reply";
}

export function getDeliveryExpiredReason(attempt: DeliveryAttemptPolicyLike) {
  return isPrivateReplyDelivery(attempt)
    ? "7-day private reply window expired before the delivery could be sent."
    : "24-hour messaging window expired before the delivery could be sent.";
}

export function shouldCloseConversationWindow(
  attempt: DeliveryAttemptPolicyLike,
) {
  return !isPrivateReplyDelivery(attempt);
}

export function isDeliveryPolicyWindowOpen(args: {
  attempt: DeliveryAttemptPolicyLike;
  conversation: ConversationPolicyLike | null;
  now: number;
}) {
  if (isPrivateReplyDelivery(args.attempt)) {
    return (
      (args.attempt.privateReplyExpiresAt ?? null) !== null &&
      (args.attempt.privateReplyExpiresAt ?? 0) >= args.now
    );
  }

  return (
    args.conversation !== null &&
    args.conversation.messagingWindowClosesAt !== null &&
    args.conversation.messagingWindowClosesAt >= args.now
  );
}
