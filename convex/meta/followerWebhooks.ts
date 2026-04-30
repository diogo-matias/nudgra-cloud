import { Doc, Id } from "../_generated/dataModel";
import { internalMutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { createSequenceEnrollment } from "../automations/sequences";
import { startFollowerAutomationSession } from "../automations/followerFlow";

type FollowerChange = {
  field?: string;
  value?: {
    id?: string;
    user_id?: string;
    igsid?: string;
    username?: string;
    name?: string;
    profile_pic?: string;
    profile_picture_url?: string;
    event_key?: string;
    timestamp?: number;
    time?: number;
    from?: {
      id?: string;
      username?: string;
      name?: string;
      profile_pic?: string;
      profile_picture_url?: string;
    };
  };
};

type FollowerEntry = {
  id?: string;
  changes?: FollowerChange[];
};

function stringifyPayload(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ error: "Could not serialize payload" });
  }
}

function isFollowerField(field: string | undefined) {
  return field === "followers" || field === "follower" || field === "follow";
}

function getFollowerItems(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [] as Array<{
      instagramAccountExternalId: string;
      followerUserId: string;
      followerUsername: string | null;
      followerDisplayName: string | null;
      followerProfilePictureUrl: string | null;
      eventKey: string;
      timestamp: number;
      rawChange: FollowerChange;
    }>;
  }

  const entries = Array.isArray((payload as { entry?: unknown[] }).entry)
    ? (payload as { entry: unknown[] }).entry
    : [];
  const items: Array<{
    instagramAccountExternalId: string;
    followerUserId: string;
    followerUsername: string | null;
    followerDisplayName: string | null;
    followerProfilePictureUrl: string | null;
    eventKey: string;
    timestamp: number;
    rawChange: FollowerChange;
  }> = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const instagramAccountExternalId = String((entry as FollowerEntry).id ?? "");
    if (!instagramAccountExternalId) {
      continue;
    }

    const changes = Array.isArray((entry as FollowerEntry).changes)
      ? (entry as FollowerEntry).changes!
      : [];

    for (const change of changes) {
      if (!isFollowerField(change.field) || !change.value) {
        continue;
      }

      const value = change.value;
      const followerUserId =
        value.from?.id ?? value.igsid ?? value.user_id ?? value.id ?? "";
      if (!followerUserId) {
        continue;
      }

      const timestamp =
        typeof value.timestamp === "number"
          ? value.timestamp * (value.timestamp < 10_000_000_000 ? 1000 : 1)
          : typeof value.time === "number"
            ? value.time * (value.time < 10_000_000_000 ? 1000 : 1)
            : Date.now();
      const eventKey =
        typeof value.event_key === "string" && value.event_key.trim()
          ? value.event_key.trim()
          : `${instagramAccountExternalId}:${followerUserId}:${timestamp}`;

      items.push({
        instagramAccountExternalId,
        followerUserId,
        followerUsername: value.from?.username ?? value.username ?? null,
        followerDisplayName:
          value.from?.name ??
          value.name ??
          value.from?.username ??
          value.username ??
          null,
        followerProfilePictureUrl:
          value.from?.profile_picture_url ??
          value.from?.profile_pic ??
          value.profile_picture_url ??
          value.profile_pic ??
          null,
        eventKey,
        timestamp,
        rawChange: change,
      });
    }
  }

  return items;
}

async function applyContactTagsIfMissing(
  ctx: Parameters<typeof startFollowerAutomationSession>[0],
  args: {
    workspaceId: Id<"workspaces">;
    contactId: Id<"contacts">;
    tagIds: Id<"tags">[];
    appliedAt: number;
  },
) {
  for (const tagId of args.tagIds) {
    const existingContactTag = await ctx.db
      .query("contactTags")
      .withIndex("by_contact_id_and_tag_id", (q) =>
        q.eq("contactId", args.contactId).eq("tagId", tagId),
      )
      .unique();

    if (existingContactTag !== null) {
      continue;
    }

    await ctx.db.insert("contactTags", {
      workspaceId: args.workspaceId,
      contactId: args.contactId,
      tagId,
      source: "follower_automation",
      appliedAt: args.appliedAt,
    });
  }
}

async function upsertFollowerContactAndConversation(
  ctx: Parameters<typeof startFollowerAutomationSession>[0],
  args: {
    account: Doc<"instagramAccounts">;
    followerUserId: string;
    followerUsername: string | null;
    followerDisplayName: string | null;
    followerProfilePictureUrl: string | null;
    eventTime: number;
  },
) {
  const existingContact = await ctx.db
    .query("contacts")
    .withIndex("by_instagram_account_id_and_instagram_user_id", (q) =>
      q
        .eq("instagramAccountId", args.account._id)
        .eq("instagramUserId", args.followerUserId),
    )
    .unique();

  const contactId =
    existingContact?._id ??
    (await ctx.db.insert("contacts", {
      workspaceId: args.account.workspaceId,
      instagramAccountId: args.account._id,
      instagramUserId: args.followerUserId,
      username: args.followerUsername,
      displayName: args.followerDisplayName,
      profilePictureUrl: args.followerProfilePictureUrl,
      firstInboundAt: args.eventTime,
      lastInboundAt: args.eventTime,
      lastMessageAt: args.eventTime,
      profilePictureFetchedAt:
        args.followerProfilePictureUrl !== null ? args.eventTime : null,
    }));

  if (existingContact) {
    await ctx.db.patch(existingContact._id, {
      username: args.followerUsername ?? existingContact.username,
      displayName:
        args.followerDisplayName ??
        args.followerUsername ??
        existingContact.displayName,
      profilePictureUrl:
        args.followerProfilePictureUrl ?? existingContact.profilePictureUrl,
      profilePictureFetchedAt:
        args.followerProfilePictureUrl !== null
          ? args.eventTime
          : existingContact.profilePictureFetchedAt,
      lastMessageAt: Math.max(existingContact.lastMessageAt, args.eventTime),
    });
  }

  const existingConversation = await ctx.db
    .query("conversations")
    .withIndex("by_instagram_account_id_and_contact_id", (q) =>
      q.eq("instagramAccountId", args.account._id).eq("contactId", contactId),
    )
    .unique();

  const conversationId =
    existingConversation?._id ??
    (await ctx.db.insert("conversations", {
      workspaceId: args.account.workspaceId,
      instagramAccountId: args.account._id,
      contactId,
      conversationKey: `${args.account.instagramAccountId}:${args.followerUserId}`,
      status: "active",
      startedAt: args.eventTime,
      lastMessageAt: args.eventTime,
      lastInboundAt: args.eventTime,
      lastOutboundAt: null,
      lastMessagePreview: "Started following",
      messagingWindowClosesAt: args.eventTime + 24 * 60 * 60 * 1000,
      lastAutomationRuleId: null,
    }));

  if (existingConversation) {
    await ctx.db.patch(existingConversation._id, {
      status: "active",
      lastMessageAt: Math.max(existingConversation.lastMessageAt, args.eventTime),
      lastInboundAt:
        existingConversation.lastInboundAt === null
          ? args.eventTime
          : Math.max(existingConversation.lastInboundAt, args.eventTime),
      lastMessagePreview:
        args.eventTime >= existingConversation.lastMessageAt
          ? "Started following"
          : existingConversation.lastMessagePreview,
      messagingWindowClosesAt: args.eventTime + 24 * 60 * 60 * 1000,
    });
  }

  return { contactId, conversationId };
}

async function ingestFollowerPayloadBody(ctx: MutationCtx, body: string) {
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return { processed: 0, ignored: 1, reason: "Invalid JSON" };
    }

    const followerItems = getFollowerItems(payload);
    let processed = 0;
    let ignored = 0;

    for (const item of followerItems) {
      const account = await ctx.db
        .query("instagramAccounts")
        .withIndex("by_instagram_account_id", (q) =>
          q.eq("instagramAccountId", item.instagramAccountExternalId),
        )
        .unique();

      if (account === null) {
        ignored += 1;
        continue;
      }

      const existingEvent = await ctx.db
        .query("webhookEvents")
        .withIndex("by_delivery_key", (q) => q.eq("deliveryKey", item.eventKey))
        .unique();
      if (existingEvent !== null) {
        ignored += 1;
        continue;
      }

      await ctx.db.patch(account._id, { lastWebhookAt: Date.now() });
      const webhookEventId = await ctx.db.insert("webhookEvents", {
        workspaceId: account.workspaceId,
        instagramAccountId: account._id,
        eventType: "follower",
        deliveryKey: item.eventKey,
        payload: stringifyPayload(item.rawChange),
        receivedAt: item.timestamp,
        processedAt: null,
        processingStatus: "received",
        errorMessage: null,
      });

      const automations = await ctx.db
        .query("followerAutomations")
        .withIndex("by_instagram_account_id_and_status", (q) =>
          q.eq("instagramAccountId", account._id).eq("status", "live"),
        )
        .take(50);
      const matchedAutomation =
        [...automations].sort((a, b) => a._creationTime - b._creationTime)[0] ??
        null;

      if (matchedAutomation === null) {
        await ctx.db.patch(webhookEventId, {
          processedAt: Date.now(),
          processingStatus: "ignored",
          errorMessage: "No live follower automation matched this account.",
        });
        ignored += 1;
        continue;
      }

      const { contactId, conversationId } =
        await upsertFollowerContactAndConversation(ctx, {
          account,
          followerUserId: item.followerUserId,
          followerUsername: item.followerUsername,
          followerDisplayName: item.followerDisplayName,
          followerProfilePictureUrl: item.followerProfilePictureUrl,
          eventTime: item.timestamp,
        });

      await applyContactTagsIfMissing(ctx, {
        workspaceId: account.workspaceId,
        contactId,
        tagIds: matchedAutomation.tagIds,
        appliedAt: item.timestamp,
      });

      await startFollowerAutomationSession(ctx, matchedAutomation, {
        workspaceId: account.workspaceId,
        instagramAccountId: account._id,
        followerAutomationId: matchedAutomation._id,
        contactId,
        conversationId,
        followerEventKey: item.eventKey,
        matchedAt: item.timestamp,
      });

      if (matchedAutomation.sequenceDefinitionId !== null) {
        await createSequenceEnrollment(ctx, {
          workspaceId: account.workspaceId,
          instagramAccountId: account._id,
          contactId,
          conversationId,
          sequenceDefinitionId: matchedAutomation.sequenceDefinitionId,
        });
      }

      await ctx.db.patch(webhookEventId, {
        processedAt: Date.now(),
        processingStatus: "processed",
      });
      processed += 1;
    }

    return { processed, ignored };
}

export const ingestFollowerWebhookPayload = internalMutation({
  args: { body: v.string() },
  handler: async (ctx, args) => {
    return await ingestFollowerPayloadBody(ctx, args.body);
  },
});

export const processFollowerEvent = internalMutation({
  args: {
    instagramAccountExternalId: v.string(),
    followerUserId: v.string(),
    followerUsername: v.union(v.string(), v.null()),
    followerDisplayName: v.union(v.string(), v.null()),
    followerProfilePictureUrl: v.union(v.string(), v.null()),
    eventKey: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const payload = {
      entry: [
        {
          id: args.instagramAccountExternalId,
          changes: [
            {
              field: "followers",
              value: {
                id: args.followerUserId,
                username: args.followerUsername,
                name: args.followerDisplayName,
                profile_picture_url: args.followerProfilePictureUrl,
                timestamp: args.timestamp,
                event_key: args.eventKey,
              },
            },
          ],
        },
      ],
    };

    return await ingestFollowerPayloadBody(ctx, JSON.stringify(payload));
  },
});
