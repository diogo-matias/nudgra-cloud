import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

type ReadModelCtx = QueryCtx | MutationCtx;

type WorkspaceAutomationMaps = {
  rulesById: Map<Id<"automationRules">, Doc<"automationRules">>;
  commentAutomationsById: Map<Id<"commentAutomations">, Doc<"commentAutomations">>;
  storyAutomationsById: Map<Id<"storyAutomations">, Doc<"storyAutomations">>;
  sequencesById: Map<Id<"sequenceDefinitions">, Doc<"sequenceDefinitions">>;
};

export type SerializedTag = {
  id: Id<"tags">;
  label: string;
  color: string;
};

export type SerializedMembership = {
  id: Id<"contactAutomationMemberships">;
  kind: Doc<"contactAutomationMemberships">["automationKind"];
  label: string;
  status: string | null;
  conversationId: Id<"conversations">;
  firstMatchedAt: number;
  lastMatchedAt: number;
  automationId:
    | Id<"automationRules">
    | Id<"commentAutomations">
    | Id<"storyAutomations">
    | Id<"sequenceDefinitions">
    | null;
};

export type SerializedConversationAutomationContext = {
  kind: "rule" | "comment_automation" | "story_automation" | "sequence";
  label: string;
  status: string | null;
  detail: string;
  timestamp: number;
};

function isCommentAutomationTerminal(
  step: Doc<"commentAutomationSessions">["currentStep"],
) {
  return step === "completed" || step === "guardrail_tripped";
}

function formatCommentAutomationStep(
  step: Doc<"commentAutomationSessions">["currentStep"],
) {
  switch (step) {
    case "opening_dm_sent":
      return "Opening DM sent";
    case "awaiting_button_click":
      return "Awaiting CTA click";
    case "follow_gate_sent":
      return "Follow gate sent";
    case "awaiting_follow":
      return "Awaiting follow";
    case "email_requested":
      return "Email requested";
    case "awaiting_email":
      return "Awaiting email";
    case "link_sent":
      return "Link sent";
    case "guardrail_tripped":
      return "Paused by guardrail";
    case "completed":
      return "Completed";
    default:
      return "In progress";
  }
}

function isStoryAutomationTerminal(
  step: Doc<"storyAutomationSessions">["currentStep"],
) {
  return (
    step === "completed" ||
    step === "link_sent" ||
    step === "guardrail_tripped"
  );
}

function formatStoryAutomationStep(
  step: Doc<"storyAutomationSessions">["currentStep"],
) {
  switch (step) {
    case "follow_gate_sent":
      return "Follow gate sent";
    case "awaiting_follow":
      return "Awaiting follow";
    case "email_requested":
      return "Email requested";
    case "awaiting_email":
      return "Awaiting email";
    case "link_sent":
      return "Link sent";
    case "guardrail_tripped":
      return "Paused by guardrail";
    case "completed":
      return "Completed";
    default:
      return "In progress";
  }
}

export async function loadWorkspaceAutomationMaps(
  ctx: ReadModelCtx,
  workspaceId: Id<"workspaces">,
): Promise<WorkspaceAutomationMaps> {
  const [rules, commentAutomations, storyAutomations, sequences] =
    await Promise.all([
    ctx.db
      .query("automationRules")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
      .take(100),
    ctx.db
      .query("commentAutomations")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
      .take(100),
    ctx.db
      .query("storyAutomations")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
      .take(100),
    ctx.db
      .query("sequenceDefinitions")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
      .take(100),
    ]);

  return {
    rulesById: new Map(rules.map((rule) => [rule._id, rule])),
    commentAutomationsById: new Map(
      commentAutomations.map((automation) => [automation._id, automation]),
    ),
    storyAutomationsById: new Map(
      storyAutomations.map((automation) => [automation._id, automation]),
    ),
    sequencesById: new Map(
      sequences.map((sequence) => [sequence._id, sequence]),
    ),
  };
}

export async function loadContactTags(
  ctx: ReadModelCtx,
  contactId: Id<"contacts">,
): Promise<SerializedTag[]> {
  const contactTags = await ctx.db
    .query("contactTags")
    .withIndex("by_contact_id", (q) => q.eq("contactId", contactId))
    .take(20);
  const tags = await Promise.all(
    contactTags.map((contactTag) => ctx.db.get(contactTag.tagId)),
  );

  return tags
    .filter((tag): tag is Doc<"tags"> => tag !== null)
    .map((tag) => ({
      id: tag._id,
      label: tag.label,
      color: tag.color,
    }));
}

export async function loadContactMessageCount(
  ctx: ReadModelCtx,
  contactId: Id<"contacts">,
) {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_contact_id", (q) => q.eq("contactId", contactId))
    .take(500);
  return messages.length;
}

export async function loadLatestConversationForContact(
  ctx: ReadModelCtx,
  contactId: Id<"contacts">,
) {
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_contact_id", (q) => q.eq("contactId", contactId))
    .take(10);

  return conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt)[0] ?? null;
}

export function serializeMembership(
  membership: Doc<"contactAutomationMemberships">,
  maps: WorkspaceAutomationMaps,
): SerializedMembership {
  if (
    membership.automationKind === "rule" &&
    membership.automationRuleId !== null
  ) {
    const rule = maps.rulesById.get(membership.automationRuleId);
    return {
      id: membership._id,
      kind: membership.automationKind,
      label: rule?.name ?? "Deleted rule",
      status: rule ? (rule.isActive ? "active" : "paused") : null,
      conversationId: membership.conversationId,
      firstMatchedAt: membership.firstMatchedAt,
      lastMatchedAt: membership.lastMatchedAt,
      automationId: membership.automationRuleId,
    };
  }

  if (
    membership.automationKind === "comment_automation" &&
    membership.commentAutomationId !== null
  ) {
    const automation = maps.commentAutomationsById.get(
      membership.commentAutomationId,
    );
    return {
      id: membership._id,
      kind: membership.automationKind,
      label: automation?.name ?? "Deleted comment automation",
      status: automation?.status ?? null,
      conversationId: membership.conversationId,
      firstMatchedAt: membership.firstMatchedAt,
      lastMatchedAt: membership.lastMatchedAt,
      automationId: membership.commentAutomationId,
    };
  }

  if (
    membership.automationKind === "story_automation" &&
    membership.storyAutomationId != null
  ) {
    const automation = maps.storyAutomationsById.get(membership.storyAutomationId);
    return {
      id: membership._id,
      kind: membership.automationKind,
      label: automation?.name ?? "Deleted story automation",
      status: automation?.status ?? null,
      conversationId: membership.conversationId,
      firstMatchedAt: membership.firstMatchedAt,
      lastMatchedAt: membership.lastMatchedAt,
      automationId: membership.storyAutomationId,
    };
  }

  if (
    membership.automationKind === "sequence" &&
    membership.sequenceDefinitionId !== null
  ) {
    const sequence = maps.sequencesById.get(membership.sequenceDefinitionId);
    return {
      id: membership._id,
      kind: membership.automationKind,
      label: sequence?.name ?? "Deleted sequence",
      status: sequence ? (sequence.isActive ? "active" : "inactive") : null,
      conversationId: membership.conversationId,
      firstMatchedAt: membership.firstMatchedAt,
      lastMatchedAt: membership.lastMatchedAt,
      automationId: membership.sequenceDefinitionId,
    };
  }

  return {
    id: membership._id,
    kind: membership.automationKind,
    label: "Automation",
    status: null,
    conversationId: membership.conversationId,
    firstMatchedAt: membership.firstMatchedAt,
    lastMatchedAt: membership.lastMatchedAt,
    automationId: null,
  };
}

export async function loadContactMemberships(
  ctx: ReadModelCtx,
  contactId: Id<"contacts">,
  maps: WorkspaceAutomationMaps,
) {
  const memberships = await ctx.db
    .query("contactAutomationMemberships")
    .withIndex("by_contact_id_and_last_matched_at", (q) =>
      q.eq("contactId", contactId),
    )
    .order("desc")
    .take(25);

  return memberships.map((membership) => serializeMembership(membership, maps));
}

export async function loadConversationAutomationContext(
  ctx: ReadModelCtx,
  conversation: Doc<"conversations">,
  maps: WorkspaceAutomationMaps,
): Promise<SerializedConversationAutomationContext | null> {
  const activeStorySession = (
    await ctx.db
      .query("storyAutomationSessions")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .order("desc")
      .take(10)
  ).find((session) => !isStoryAutomationTerminal(session.currentStep));

  if (activeStorySession) {
    const automation = maps.storyAutomationsById.get(
      activeStorySession.storyAutomationId,
    );
    return {
      kind: "story_automation",
      label: automation?.name ?? "Story automation",
      status: automation?.status ?? null,
      detail: formatStoryAutomationStep(activeStorySession.currentStep),
      timestamp: activeStorySession.lastStepAt,
    };
  }

  const activeCommentSession = (
    await ctx.db
      .query("commentAutomationSessions")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .order("desc")
      .take(10)
  ).find((session) => !isCommentAutomationTerminal(session.currentStep));

  if (activeCommentSession) {
    const automation = maps.commentAutomationsById.get(
      activeCommentSession.commentAutomationId,
    );
    return {
      kind: "comment_automation",
      label: automation?.name ?? "Comment automation",
      status: automation?.status ?? null,
      detail: formatCommentAutomationStep(activeCommentSession.currentStep),
      timestamp: activeCommentSession.lastStepAt,
    };
  }

  const relatedEnrollments = (
    await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_contact_id", (q) => q.eq("contactId", conversation.contactId))
      .take(20)
  ).filter((enrollment) => enrollment.conversationId === conversation._id);

  if (relatedEnrollments.length > 0) {
    const chosenEnrollment =
      relatedEnrollments
        .filter((enrollment) => enrollment.status === "active")
        .sort((a, b) => b.enrolledAt - a.enrolledAt)[0] ??
      relatedEnrollments.sort((a, b) => b.enrolledAt - a.enrolledAt)[0] ??
      null;

    if (chosenEnrollment) {
      const sequence = maps.sequencesById.get(chosenEnrollment.sequenceDefinitionId);
      return {
        kind: "sequence",
        label: sequence?.name ?? "Sequence",
        status: chosenEnrollment.status,
        detail:
          chosenEnrollment.status === "active"
            ? "Sequence running"
            : `Sequence ${chosenEnrollment.status}`,
        timestamp:
          chosenEnrollment.lastProcessedAt ?? chosenEnrollment.enrolledAt,
      };
    }
  }

  if (conversation.lastAutomationRuleId !== null) {
    const rule = maps.rulesById.get(conversation.lastAutomationRuleId);
    return {
      kind: "rule",
      label: rule?.name ?? "Automation rule",
      status: rule ? (rule.isActive ? "active" : "paused") : null,
      detail: "Latest matched rule",
      timestamp: conversation.lastMessageAt,
    };
  }

  return null;
}
