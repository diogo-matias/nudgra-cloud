import { requireSiteUrl } from "../meta/config";
import { type AutomatedButton } from "../meta/sendHelpers";

export type FollowGateCheckStatus =
  | "following"
  | "not_following"
  | "consent_required";

export type FollowGateInputMode = "button" | "reply";

export type GuardrailReasonArgs = {
  automationLabel: string;
  limitType: "session" | "conversation_window";
  limit: number;
  purpose: string;
  windowLabel: string;
};

type WebUrlButton = Extract<AutomatedButton, { type: "web_url" }>;

export function getFollowGateInputMode(
  consentRequired: boolean,
): FollowGateInputMode {
  return consentRequired ? "reply" : "button";
}

export function hasInboundInteraction(args: {
  hasMessage: boolean;
  postbackPayload: string | null;
  quickReplyPayload: string | null;
}) {
  return (
    args.hasMessage ||
    args.postbackPayload !== null ||
    args.quickReplyPayload !== null
  );
}

export function isTerminalAutomationSessionStep(step: string) {
  return step === "completed" || step === "link_sent" || step === "guardrail_tripped";
}

export function buildAutomationGuardrailReason(args: GuardrailReasonArgs) {
  const suffix = args.limit === 1 ? "" : "s";

  if (args.limitType === "session") {
    return `Safety guardrail paused this ${args.automationLabel} after ${args.limit} outbound DM${suffix} in the same session while sending ${args.purpose}.`;
  }

  return `Safety guardrail paused this ${args.automationLabel} after ${args.limit} outbound DM${suffix} from the same automation type in the same conversation within ${args.windowLabel} while sending ${args.purpose}.`;
}

export function extractEmail(text: string | null): string | null {
  if (!text) {
    return null;
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

export function chunkButtons<T>(buttons: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < buttons.length; index += size) {
    chunks.push(buttons.slice(index, index + size));
  }

  return chunks;
}

export async function createTrackedLinkButtons(args: {
  buttons: WebUrlButton[];
  routePrefix:
    | "/api/comment-automation/links"
    | "/api/rule-automation/links"
    | "/api/story-automation/links"
    | "/api/follower-automation/links";
  insertTrackedLink: (input: {
    token: string;
    destinationUrl: string;
    label: string;
    buttonIndex: number;
    createdAt: number;
  }) => Promise<void>;
}) {
  const trackedButtons: WebUrlButton[] = [];

  if (args.buttons.length === 0) {
    return trackedButtons;
  }

  const siteUrl = requireSiteUrl();
  const createdAt = Date.now();

  for (const [buttonIndex, button] of args.buttons.entries()) {
    const token = crypto.randomUUID();
    await args.insertTrackedLink({
      token,
      destinationUrl: button.url,
      label: button.title,
      buttonIndex,
      createdAt,
    });

    trackedButtons.push({
      type: "web_url",
      title: button.title,
      url: new URL(`${args.routePrefix}/${token}`, siteUrl).toString(),
    });
  }

  return trackedButtons;
}
