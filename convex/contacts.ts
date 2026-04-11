import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
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
    kind: v.literal("sequence"),
    sequenceDefinitionId: v.id("sequenceDefinitions"),
  }),
);

const nullableAutomationRuleId = v.union(v.id("automationRules"), v.null());
const nullableCommentAutomationId = v.union(v.id("commentAutomations"), v.null());
const nullableSequenceDefinitionId = v.union(
  v.id("sequenceDefinitions"),
  v.null(),
);
const nullableString = v.union(v.string(), v.null());
const CONTACT_PROFILE_REFRESH_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000;

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
  const [tags, automations, latestConversation, messageCount] = await Promise.all([
    loadContactTags(ctx, contact._id),
    loadContactMemberships(ctx, contact._id, maps),
    loadLatestConversationForContact(ctx, contact._id),
    loadContactMessageCount(ctx, contact._id),
  ]);

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
    latestConversationId: latestConversation?._id ?? null,
  };
}

export const listAutomationFilters = query({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const [rules, commentAutomations, sequences] = await Promise.all([
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
        .query("sequenceDefinitions")
        .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
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
      sequences: serializedSequences,
    };
  },
});

export const listContacts = query({
  args: {
    accountId: v.id("instagramAccounts"),
    automationFilter: automationFilterValidator,
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);

    let contacts;
    if (args.automationFilter === null) {
      contacts = await ctx.db
        .query("contacts")
        .withIndex("by_instagram_account_id_and_last_message_at", (q) =>
          q.eq("instagramAccountId", args.accountId),
        )
        .order("desc")
        .take(100);
    } else {
      const filter = args.automationFilter;
      const memberships =
        filter.kind === "rule"
          ? await ctx.db
              .query("contactAutomationMemberships")
              .withIndex("by_workspace_id_and_rule_id", (q) =>
                q.eq("workspaceId", workspace._id).eq("automationRuleId", filter.automationRuleId),
              )
              .take(200)
          : filter.kind === "comment_automation"
            ? await ctx.db
                .query("contactAutomationMemberships")
                .withIndex("by_workspace_id_and_comment_automation_id", (q) =>
                  q
                    .eq("workspaceId", workspace._id)
                    .eq("commentAutomationId", filter.commentAutomationId),
                )
                .take(200)
            : await ctx.db
                .query("contactAutomationMemberships")
                .withIndex("by_workspace_id_and_sequence_definition_id", (q) =>
                  q
                    .eq("workspaceId", workspace._id)
                    .eq("sequenceDefinitionId", filter.sequenceDefinitionId),
                )
                .take(200);

      const uniqueContactIds = [...new Set(memberships.map((row) => row.contactId))];
      contacts = (
        await Promise.all(uniqueContactIds.map((contactId) => ctx.db.get(contactId)))
      )
        .filter(
          (contact): contact is NonNullable<typeof contact> =>
            contact !== null &&
            contact.workspaceId === workspace._id &&
            contact.instagramAccountId === args.accountId,
        )
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
        .slice(0, 100);
    }

    return await Promise.all(
      contacts.map((contact) => loadContactListItem(ctx, workspace._id, contact)),
    );
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
    const [tags, automations, latestConversation, messageCount, enrollments] =
      await Promise.all([
        loadContactTags(ctx, contact._id),
        loadContactMemberships(ctx, contact._id, maps),
        loadLatestConversationForContact(ctx, contact._id),
        loadContactMessageCount(ctx, contact._id),
        ctx.db
          .query("sequenceEnrollments")
          .withIndex("by_contact_id", (q) => q.eq("contactId", contact._id))
          .take(20),
      ]);

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
      latestConversationId: latestConversation?._id ?? null,
      sequenceEnrollments: await Promise.all(
        enrollments
          .sort((a, b) => b.enrolledAt - a.enrolledAt)
          .map(async (enrollment) => {
            const definition = maps.sequencesById.get(enrollment.sequenceDefinitionId);
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
      v.literal("sequence"),
    ),
    automationRuleId: nullableAutomationRuleId,
    commentAutomationId: nullableCommentAutomationId,
    sequenceDefinitionId: nullableSequenceDefinitionId,
    matchedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contactAutomationMemberships")
      .withIndex("by_contact_and_kind_and_rule_and_comment_and_sequence", (q) =>
        q
          .eq("contactId", args.contactId)
          .eq("automationKind", args.automationKind)
          .eq("automationRuleId", args.automationRuleId)
          .eq("commentAutomationId", args.commentAutomationId)
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
      sequenceDefinitionId: args.sequenceDefinitionId,
      firstMatchedAt: args.matchedAt,
      lastMatchedAt: args.matchedAt,
    });
  },
});
