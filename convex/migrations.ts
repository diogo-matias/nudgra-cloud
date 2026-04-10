import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { computeNextRefreshAt } from "./meta/authShared";

export const migrations = new Migrations<DataModel>(components.migrations, {
  migrationsLocationPrefix: "migrations:",
});

export const backfillRuleMemberships = migrations.define({
  table: "deliveryAttempts",
  migrateOne: async (ctx, deliveryAttempt) => {
    if (deliveryAttempt.automationRuleId === null) {
      return;
    }

    await ctx.runMutation(internal.contacts.upsertContactAutomationMembership, {
      workspaceId: deliveryAttempt.workspaceId,
      contactId: deliveryAttempt.contactId,
      conversationId: deliveryAttempt.conversationId,
      automationKind: "rule",
      automationRuleId: deliveryAttempt.automationRuleId,
      commentAutomationId: null,
      sequenceDefinitionId: null,
      matchedAt: deliveryAttempt.eventTime,
    });
  },
});

export const backfillSequenceMemberships = migrations.define({
  table: "sequenceEnrollments",
  migrateOne: async (ctx, enrollment) => {
    await ctx.runMutation(internal.contacts.upsertContactAutomationMembership, {
      workspaceId: enrollment.workspaceId,
      contactId: enrollment.contactId,
      conversationId: enrollment.conversationId,
      automationKind: "sequence",
      automationRuleId: null,
      commentAutomationId: null,
      sequenceDefinitionId: enrollment.sequenceDefinitionId,
      matchedAt: enrollment.enrolledAt,
    });
  },
});

export const backfillCommentAutomationMemberships = migrations.define({
  table: "commentAutomationSessions",
  migrateOne: async (ctx, session) => {
    await ctx.runMutation(internal.contacts.upsertContactAutomationMembership, {
      workspaceId: session.workspaceId,
      contactId: session.contactId,
      conversationId: session.conversationId,
      automationKind: "comment_automation",
      automationRuleId: null,
      commentAutomationId: session.commentAutomationId,
      sequenceDefinitionId: null,
      matchedAt: session.startedAt,
    });
  },
});

export const backfillInstagramAccountTokenLifecycle = migrations.define({
  table: "instagramAccounts",
  migrateOne: async (ctx, account) => {
    const now = Date.now();
    const lastError = account.lastError ?? "";
    const looksLikeAuthFailure =
      lastError.toLowerCase().includes("token") ||
      lastError.toLowerCase().includes("reconnect") ||
      lastError.toLowerCase().includes("oauth");
    const reconnectRequired =
      account.reconnectRequired ??
      (account.status === "connection_error" && looksLikeAuthFailure);
    const normalizedStatus =
      account.status === "connection_error" && !reconnectRequired
        ? "connected"
        : account.status;

    await ctx.db.patch(account._id, {
      status: normalizedStatus,
      reconnectRequired,
      lastRefreshAttemptAt: account.lastRefreshAttemptAt ?? null,
      lastTokenRefreshAt:
        account.lastTokenRefreshAt ??
        (account.graphAccessToken ? (account.connectedAt ?? now) : null),
      nextRefreshAt:
        account.nextRefreshAt ??
        (account.graphAccessToken
          ? computeNextRefreshAt(account.tokenExpiresAt ?? null, now)
          : null),
      refreshFailureCount:
        account.refreshFailureCount ?? (reconnectRequired ? 1 : 0),
    });
  },
});

export const run = migrations.runner();

export const runAll = migrations.runner([
  internal.migrations.backfillRuleMemberships,
  internal.migrations.backfillSequenceMemberships,
  internal.migrations.backfillCommentAutomationMemberships,
  internal.migrations.backfillInstagramAccountTokenLifecycle,
]);
