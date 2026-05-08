import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  requireCurrentWorkspace,
  requireWorkspaceInstagramAccount,
} from "./lib/auth";
import {
  loadContactMemberships,
  loadContactMessageCount,
  loadContactTags,
  loadLatestConversationForContact,
  loadWorkspaceAutomationMaps,
} from "./lib/readModels";

const automationFilterValidator = v.union(
  v.null(),
  v.object({
    kind: v.literal("rule"),
    automationRuleId: v.id("automationRules"),
  }),
  v.object({
    kind: v.literal("comment_automation"),
    commentAutomationId: v.id("commentAutomations"),
  }),
  v.object({
    kind: v.literal("story_automation"),
    storyAutomationId: v.id("storyAutomations"),
  }),
  v.object({
    kind: v.literal("follower_automation"),
    followerAutomationId: v.id("followerAutomations"),
  }),
  v.object({
    kind: v.literal("sequence"),
    sequenceDefinitionId: v.id("sequenceDefinitions"),
  }),
);

type AutomationFilter =
  | {
      kind: "rule";
      automationRuleId: Id<"automationRules">;
    }
  | {
      kind: "comment_automation";
      commentAutomationId: Id<"commentAutomations">;
    }
  | {
      kind: "story_automation";
      storyAutomationId: Id<"storyAutomations">;
    }
  | {
      kind: "follower_automation";
      followerAutomationId: Id<"followerAutomations">;
    }
  | {
      kind: "sequence";
      sequenceDefinitionId: Id<"sequenceDefinitions">;
    };

const contactEmailAutomationKindValidator = v.union(
  v.literal("rule"),
  v.literal("comment_automation"),
  v.literal("story_automation"),
  v.literal("follower_automation"),
);
const nullableAutomationRuleId = v.union(v.id("automationRules"), v.null());
const nullableCommentAutomationId = v.union(
  v.id("commentAutomations"),
  v.null(),
);
const nullableStoryAutomationId = v.union(v.id("storyAutomations"), v.null());
const nullableFollowerAutomationId = v.union(
  v.id("followerAutomations"),
  v.null(),
);
const nullableSequenceDefinitionId = v.union(
  v.id("sequenceDefinitions"),
  v.null(),
);
const nullableConversationId = v.union(v.id("conversations"), v.null());
const nullableString = v.union(v.string(), v.null());
const CONTACT_PROFILE_REFRESH_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000;
const CONTACT_EMAIL_LIMIT = 100;
const DEFAULT_CONTACT_PAGE_SIZE = 50;
const MAX_CONTACT_PAGE_SIZE = 100;

type WorkspaceAutomationMaps = Awaited<
  ReturnType<typeof loadWorkspaceAutomationMaps>
>;

function shouldQueueContactProfileRefresh(
  contact: { profilePictureFetchedAt?: number | null },
  now: number,
) {
  return (
    contact.profilePictureFetchedAt === undefined ||
    contact.profilePictureFetchedAt === null ||
    now - contact.profilePictureFetchedAt > CONTACT_PROFILE_REFRESH_INTERVAL_MS
  );
}

async function loadStoredContactEmails(
  ctx: QueryCtx,
  contactId: Id<"contacts">,
) {
  return await ctx.db
    .query("contactEmails")
    .withIndex("by_contact_id_and_last_collected_at", (q) =>
      q.eq("contactId", contactId),
    )
    .order("desc")
    .take(CONTACT_EMAIL_LIMIT);
}

function summarizeStoredContactEmails(storedEmails: Doc<"contactEmails">[]) {
  return {
    latestEmail: storedEmails[0]?.email ?? null,
    emailCount: storedEmails.length,
    emails: storedEmails.map((storedEmail) => storedEmail.email),
  };
}

function getContactEmailSourceLabel(
  storedEmail: Doc<"contactEmails">,
  maps: WorkspaceAutomationMaps,
) {
  switch (storedEmail.automationKind) {
    case "rule":
      return storedEmail.automationRuleId
        ? (maps.rulesById.get(storedEmail.automationRuleId)?.name ??
            "Deleted rule")
        : "Rule automation";
    case "comment_automation":
      return storedEmail.commentAutomationId
        ? (maps.commentAutomationsById.get(storedEmail.commentAutomationId)
            ?.name ?? "Deleted comment automation")
        : "Comment automation";
    case "story_automation":
      return storedEmail.storyAutomationId
        ? (maps.storyAutomationsById.get(storedEmail.storyAutomationId)?.name ??
            "Deleted story automation")
        : "Story automation";
    case "follower_automation":
      return storedEmail.followerAutomationId
        ? (maps.followerAutomationsById.get(storedEmail.followerAutomationId)
            ?.name ?? "Deleted follower automation")
        : "Follower automation";
    default:
      return "Automation";
  }
}

async function loadContactListItem(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  contact: {
    _id: Id<"contacts">;
    username: string | null;
    displayName: string | null;
    profilePictureUrl: string | null;
    firstInboundAt: number;
    lastInboundAt: number;
    lastMessageAt: number;
  },
) {
  const maps = await loadWorkspaceAutomationMaps(ctx, workspaceId);
  const [tags, automations, latestConversation, messageCount, storedEmails] =
    await Promise.all([
      loadContactTags(ctx, contact._id),
      loadContactMemberships(ctx, contact._id, maps),
      loadLatestConversationForContact(ctx, contact._id),
      loadContactMessageCount(ctx, contact._id),
      loadStoredContactEmails(ctx, contact._id),
    ]);
  const emailSummary = summarizeStoredContactEmails(storedEmails);

  return {
    id: contact._id,
    username: contact.username,
    displayName: contact.displayName,
    profilePictureUrl: contact.profilePictureUrl,
    subscribedAt: contact.firstInboundAt,
    firstInboundAt: contact.firstInboundAt,
    lastInboundAt: contact.lastInboundAt,
    lastMessageAt: contact.lastMessageAt,
    messageCount,
    tags,
    automations,
    latestEmail: emailSummary.latestEmail,
    emailCount: emailSummary.emailCount,
    emails: emailSummary.emails,
    latestConversationId: latestConversation?._id ?? null,
  };
}

function normalizeContactPageSize(limit: number) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_CONTACT_PAGE_SIZE;
  }

  return Math.min(Math.max(Math.floor(limit), 1), MAX_CONTACT_PAGE_SIZE);
}

function parseFilteredContactsCursor(cursor: string | null) {
  if (cursor === null) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

async function loadAutomationFilteredContacts(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"instagramAccounts">,
  automationFilter: AutomationFilter,
  limit: number,
  cursor: string | null,
) {
  const memberships =
    automationFilter.kind === "rule"
      ? await ctx.db
          .query("contactAutomationMemberships")
          .withIndex("by_workspace_id_and_rule_id", (q) =>
            q
              .eq("workspaceId", workspaceId)
              .eq("automationRuleId", automationFilter.automationRuleId),
          )
          .collect()
      : automationFilter.kind === "comment_automation"
        ? await ctx.db
            .query("contactAutomationMemberships")
            .withIndex("by_workspace_id_and_comment_automation_id", (q) =>
              q
                .eq("workspaceId", workspaceId)
                .eq(
                  "commentAutomationId",
                  automationFilter.commentAutomationId,
                ),
            )
            .collect()
        : automationFilter.kind === "story_automation"
          ? await ctx.db
              .query("contactAutomationMemberships")
              .withIndex("by_workspace_id_and_story_automation_id", (q) =>
                q
                  .eq("workspaceId", workspaceId)
                  .eq("storyAutomationId", automationFilter.storyAutomationId),
              )
              .collect()
          : automationFilter.kind === "follower_automation"
            ? await ctx.db
                .query("contactAutomationMemberships")
                .withIndex("by_workspace_id_and_follower_automation_id", (q) =>
                  q
                    .eq("workspaceId", workspaceId)
                    .eq(
                      "followerAutomationId",
                      automationFilter.followerAutomationId,
                    ),
                )
                .collect()
            : await ctx.db
              .query("contactAutomationMemberships")
              .withIndex("by_workspace_id_and_sequence_definition_id", (q) =>
                q
                  .eq("workspaceId", workspaceId)
                  .eq(
                    "sequenceDefinitionId",
                    automationFilter.sequenceDefinitionId,
                  ),
              )
              .collect();

  const uniqueContactIds = [
    ...new Set(memberships.map((membership) => membership.contactId)),
  ];
  const contacts = (
    await Promise.all(
      uniqueContactIds.map((contactId) => ctx.db.get(contactId)),
    )
  )
    .filter(
      (contact): contact is NonNullable<typeof contact> =>
        contact !== null &&
        contact.workspaceId === workspaceId &&
        contact.instagramAccountId === accountId,
    )
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  const start = parseFilteredContactsCursor(cursor);
  const page = contacts.slice(start, start + limit);
  const nextOffset = start + page.length;

  return {
    page,
    isDone: nextOffset >= contacts.length,
    continueCursor: nextOffset >= contacts.length ? null : String(nextOffset),
  };
}

export const listAutomationFilters = query({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const [rules, commentAutomations, storyAutomations, followerAutomations, sequences] =
      await Promise.all([
        ctx.db
          .query("automationRules")
          .withIndex("by_instagram_account_id", (q) =>
            q.eq("instagramAccountId", args.accountId),
          )
          .take(100),
        ctx.db
          .query("commentAutomations")
          .withIndex("by_instagram_account_id", (q) =>
            q.eq("instagramAccountId", args.accountId),
          )
          .take(100),
        ctx.db
          .query("storyAutomations")
          .withIndex("by_instagram_account_id", (q) =>
            q.eq("instagramAccountId", args.accountId),
          )
          .take(100),
        ctx.db
          .query("followerAutomations")
          .withIndex("by_instagram_account_id", (q) =>
            q.eq("instagramAccountId", args.accountId),
          )
          .take(100),
        ctx.db
          .query("sequenceDefinitions")
          .withIndex("by_workspace_id", (q) =>
            q.eq("workspaceId", workspace._id),
          )
          .take(25),
      ]);

    const serializedRules = [...rules]
      .map((rule) => ({
        id: rule._id,
        label: rule.name,
        kind: "rule" as const,
        status: rule.isActive ? "active" : "paused",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const serializedCommentAutomations = [...commentAutomations]
      .map((automation) => ({
        id: automation._id,
        label: automation.name,
        kind: "comment_automation" as const,
        status: automation.status,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const serializedStoryAutomations = [...storyAutomations]
      .map((automation) => ({
        id: automation._id,
        label: automation.name,
        kind: "story_automation" as const,
        status: automation.status,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const serializedFollowerAutomations = [...followerAutomations]
      .map((automation) => ({
        id: automation._id,
        label: automation.name,
        kind: "follower_automation" as const,
        status: automation.status,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const serializedSequences = [...sequences]
      .map((sequence) => ({
        id: sequence._id,
        label: sequence.name,
        kind: "sequence" as const,
        status: sequence.isActive ? "active" : "inactive",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      rules: serializedRules,
      commentAutomations: serializedCommentAutomations,
      storyAutomations: serializedStoryAutomations,
      followerAutomations: serializedFollowerAutomations,
      sequences: serializedSequences,
    };
  },
});

export const listContacts = query({
  args: {
    accountId: v.id("instagramAccounts"),
    automationFilter: automationFilterValidator,
    limit: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const limit = normalizeContactPageSize(args.limit);

    const page =
      args.automationFilter === null
        ? await ctx.db
            .query("contacts")
            .withIndex("by_instagram_account_id_and_last_message_at", (q) =>
              q.eq("instagramAccountId", args.accountId),
            )
            .order("desc")
            .paginate({ numItems: limit, cursor: args.cursor })
        : await loadAutomationFilteredContacts(
            ctx,
            workspace._id,
            args.accountId,
            args.automationFilter,
            limit,
            args.cursor,
          );

    const contacts = await Promise.all(
      page.page.map((contact) =>
        loadContactListItem(ctx, workspace._id, contact),
      ),
    );

    return {
      contacts,
      nextCursor: page.isDone ? null : page.continueCursor,
      hasMore: !page.isDone,
    };
  },
});

export const getContactDetail = query({
  args: {
    accountId: v.id("instagramAccounts"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const contact = await ctx.db.get(args.contactId);
    if (
      contact === null ||
      contact.workspaceId !== workspace._id ||
      contact.instagramAccountId !== args.accountId
    ) {
      return null;
    }

    const maps = await loadWorkspaceAutomationMaps(ctx, workspace._id);
    const [
      tags,
      automations,
      latestConversation,
      messageCount,
      enrollments,
      storedEmails,
    ] = await Promise.all([
      loadContactTags(ctx, contact._id),
      loadContactMemberships(ctx, contact._id, maps),
      loadLatestConversationForContact(ctx, contact._id),
      loadContactMessageCount(ctx, contact._id),
      ctx.db
        .query("sequenceEnrollments")
        .withIndex("by_contact_id", (q) => q.eq("contactId", contact._id))
        .take(20),
      loadStoredContactEmails(ctx, contact._id),
    ]);
    const emailSummary = summarizeStoredContactEmails(storedEmails);

    return {
      id: contact._id,
      instagramUserId: contact.instagramUserId,
      username: contact.username,
      displayName: contact.displayName,
      profilePictureUrl: contact.profilePictureUrl,
      subscribedAt: contact.firstInboundAt,
      firstInboundAt: contact.firstInboundAt,
      lastInboundAt: contact.lastInboundAt,
      lastMessageAt: contact.lastMessageAt,
      messageCount,
      tags,
      automations,
      latestEmail: emailSummary.latestEmail,
      emailCount: emailSummary.emailCount,
      latestConversationId: latestConversation?._id ?? null,
      emails: storedEmails.map((storedEmail) => ({
        id: storedEmail._id,
        email: storedEmail.email,
        firstCollectedAt: storedEmail.firstCollectedAt,
        lastCollectedAt: storedEmail.lastCollectedAt,
        sourceLabel: getContactEmailSourceLabel(storedEmail, maps),
      })),
      sequenceEnrollments: await Promise.all(
        enrollments
          .sort((a, b) => b.enrolledAt - a.enrolledAt)
          .map(async (enrollment) => {
            const definition = maps.sequencesById.get(
              enrollment.sequenceDefinitionId,
            );
            return {
              id: enrollment._id,
              name: definition?.name ?? "Sequence",
              status: enrollment.status,
              enrolledAt: enrollment.enrolledAt,
              nextRunAt: enrollment.nextRunAt,
              currentStepIndex: enrollment.currentStepIndex,
              conversationId: enrollment.conversationId,
            };
          }),
      ),
    };
  },
});

export const upsertCollectedContactEmail = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    contactId: v.id("contacts"),
    conversationId: nullableConversationId,
    email: v.string(),
    collectedAt: v.number(),
    automationKind: contactEmailAutomationKindValidator,
    automationRuleId: nullableAutomationRuleId,
    commentAutomationId: nullableCommentAutomationId,
    storyAutomationId: v.optional(nullableStoryAutomationId),
    followerAutomationId: v.optional(nullableFollowerAutomationId),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("contactEmails")
      .withIndex("by_contact_id_and_email", (q) =>
        q.eq("contactId", args.contactId).eq("email", normalizedEmail),
      )
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        firstCollectedAt: Math.min(existing.firstCollectedAt, args.collectedAt),
        lastCollectedAt: Math.max(existing.lastCollectedAt, args.collectedAt),
        ...(args.collectedAt >= existing.lastCollectedAt
          ? {
              automationKind: args.automationKind,
              automationRuleId: args.automationRuleId,
              commentAutomationId: args.commentAutomationId,
              storyAutomationId: args.storyAutomationId ?? null,
              followerAutomationId: args.followerAutomationId ?? null,
              conversationId: args.conversationId,
            }
          : {}),
      });
      return existing._id;
    }

    return await ctx.db.insert("contactEmails", {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      contactId: args.contactId,
      email: normalizedEmail,
      firstCollectedAt: args.collectedAt,
      lastCollectedAt: args.collectedAt,
      automationKind: args.automationKind,
      automationRuleId: args.automationRuleId,
      commentAutomationId: args.commentAutomationId,
      storyAutomationId: args.storyAutomationId ?? null,
      followerAutomationId: args.followerAutomationId ?? null,
      conversationId: args.conversationId,
    });
  },
});

export const requestContactProfileRefresh = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const contact = await ctx.db.get(args.contactId);

    if (
      contact === null ||
      contact.workspaceId !== workspace._id ||
      contact.instagramAccountId !== args.accountId
    ) {
      return false;
    }

    if (!shouldQueueContactProfileRefresh(contact, Date.now())) {
      return false;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.meta.contactProfiles.refreshContactProfile,
      { contactId: contact._id },
    );

    return true;
  },
});

export const getContactProfileRefreshContext = internalQuery({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (contact === null) {
      return null;
    }

    const account = await ctx.db.get(contact.instagramAccountId);
    if (
      account === null ||
      account.status !== "connected" ||
      account.graphAccessToken === null
    ) {
      return null;
    }

    return {
      contactId: contact._id,
      instagramUserId: contact.instagramUserId,
      accountId: account._id,
      graphAccessToken: account.graphAccessToken,
      graphApiVersion: account.graphApiVersion,
    };
  },
});

export const applyFetchedContactProfile = internalMutation({
  args: {
    contactId: v.id("contacts"),
    username: nullableString,
    displayName: nullableString,
    profilePictureUrl: nullableString,
    fetchedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (contact === null) {
      return null;
    }

    await ctx.db.patch(contact._id, {
      username: args.username ?? contact.username,
      displayName: args.displayName ?? args.username ?? contact.displayName,
      profilePictureUrl: args.profilePictureUrl,
      profilePictureFetchedAt: args.fetchedAt,
    });

    return null;
  },
});

export const markContactProfileRefreshAttempt = internalMutation({
  args: {
    contactId: v.id("contacts"),
    fetchedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (contact === null) {
      return null;
    }

    await ctx.db.patch(contact._id, {
      profilePictureFetchedAt: args.fetchedAt,
    });

    return null;
  },
});

export const upsertContactAutomationMembership = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    contactId: v.id("contacts"),
    conversationId: v.id("conversations"),
    automationKind: v.union(
      v.literal("rule"),
      v.literal("comment_automation"),
      v.literal("story_automation"),
      v.literal("follower_automation"),
      v.literal("sequence"),
    ),
    automationRuleId: nullableAutomationRuleId,
    commentAutomationId: nullableCommentAutomationId,
    storyAutomationId: v.optional(nullableStoryAutomationId),
    followerAutomationId: v.optional(nullableFollowerAutomationId),
    sequenceDefinitionId: nullableSequenceDefinitionId,
    matchedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contactAutomationMemberships")
      .withIndex(
        "by_contact_kind_automation_ids",
        (q) =>
          q
            .eq("contactId", args.contactId)
            .eq("automationKind", args.automationKind)
            .eq("automationRuleId", args.automationRuleId)
            .eq("commentAutomationId", args.commentAutomationId)
            .eq("storyAutomationId", args.storyAutomationId ?? null)
            .eq("followerAutomationId", args.followerAutomationId ?? null)
            .eq("sequenceDefinitionId", args.sequenceDefinitionId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        conversationId: args.conversationId,
        firstMatchedAt: Math.min(existing.firstMatchedAt, args.matchedAt),
        lastMatchedAt: Math.max(existing.lastMatchedAt, args.matchedAt),
      });
      return existing._id;
    }

    return await ctx.db.insert("contactAutomationMemberships", {
      workspaceId: args.workspaceId,
      contactId: args.contactId,
      conversationId: args.conversationId,
      automationKind: args.automationKind,
      automationRuleId: args.automationRuleId,
      commentAutomationId: args.commentAutomationId,
      storyAutomationId: args.storyAutomationId ?? null,
      followerAutomationId: args.followerAutomationId ?? null,
      sequenceDefinitionId: args.sequenceDefinitionId,
      firstMatchedAt: args.matchedAt,
      lastMatchedAt: args.matchedAt,
    });
  },
});
