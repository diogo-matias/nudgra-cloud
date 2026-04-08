import { internalMutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireCurrentWorkspace } from "../lib/auth";
import { queueAutomatedTextReply } from "../meta/sendHelpers";
import { MutationCtx } from "../_generated/server";

export const listSequenceDefinitions = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const definitions = await ctx.db
      .query("sequenceDefinitions")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(25);

    return definitions.map((definition) => ({
      id: definition._id,
      name: definition.name,
      isActive: definition.isActive,
      stepCount: definition.steps.length,
    }));
  },
});

export async function createSequenceEnrollment(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    contactId: Id<"contacts">;
    conversationId: Id<"conversations">;
    sequenceDefinitionId: Id<"sequenceDefinitions">;
  },
) {
  const now = Date.now();
  const sequenceDefinition = await ctx.db.get(args.sequenceDefinitionId);
  if (sequenceDefinition === null || !sequenceDefinition.isActive) {
    return null;
  }

  const firstStep = sequenceDefinition.steps[0];
  const nextRunAt = firstStep ? now + firstStep.delayMinutes * 60 * 1000 : null;

  const enrollmentId = await ctx.db.insert("sequenceEnrollments", {
    workspaceId: args.workspaceId,
    instagramAccountId: args.instagramAccountId,
    contactId: args.contactId,
    conversationId: args.conversationId,
    sequenceDefinitionId: args.sequenceDefinitionId,
    status: firstStep ? "active" : "completed",
    currentStepIndex: 0,
    nextRunAt,
    enrolledAt: now,
    lastProcessedAt: null,
    stopReason: null,
  });

  if (nextRunAt !== null && firstStep) {
    await ctx.scheduler.runAfter(
      firstStep.delayMinutes * 60 * 1000,
      internal.automations.sequences.processSequenceEnrollment,
      { enrollmentId },
    );
  }

  return enrollmentId;
}

export const processSequenceEnrollment = internalMutation({
  args: { enrollmentId: v.id("sequenceEnrollments") },
  handler: async (ctx, args) => {
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (enrollment === null || enrollment.status !== "active") {
      return null;
    }

    const sequenceDefinition = await ctx.db.get(enrollment.sequenceDefinitionId);
    const conversation = await ctx.db.get(enrollment.conversationId);
    if (sequenceDefinition === null || conversation === null) {
      await ctx.db.patch(enrollment._id, {
        status: "stopped",
        stopReason: "Sequence context is missing.",
      });
      return null;
    }

    if (
      conversation.messagingWindowClosesAt !== null &&
      conversation.messagingWindowClosesAt < Date.now()
    ) {
      await ctx.db.patch(conversation._id, { status: "window_closed" });
      await ctx.db.patch(enrollment._id, {
        status: "stopped",
        stopReason: "24-hour messaging window expired.",
        lastProcessedAt: Date.now(),
      });
      return null;
    }

    const step = sequenceDefinition.steps[enrollment.currentStepIndex];
    if (!step) {
      await ctx.db.patch(enrollment._id, {
        status: "completed",
        nextRunAt: null,
        lastProcessedAt: Date.now(),
      });
      return null;
    }

    await queueAutomatedTextReply(ctx, {
      workspaceId: enrollment.workspaceId,
      instagramAccountId: enrollment.instagramAccountId,
      conversationId: enrollment.conversationId,
      contactId: enrollment.contactId,
      messageText: step.messageText,
      automationRuleId: null,
      sequenceEnrollmentId: enrollment._id,
    });

    const nextStep = sequenceDefinition.steps[enrollment.currentStepIndex + 1];
    const nextRunAt =
      nextStep === undefined
        ? null
        : Date.now() + nextStep.delayMinutes * 60 * 1000;

    await ctx.db.patch(enrollment._id, {
      currentStepIndex: enrollment.currentStepIndex + 1,
      nextRunAt,
      lastProcessedAt: Date.now(),
      status: nextStep ? "active" : "completed",
    });

    if (nextStep) {
      await ctx.scheduler.runAfter(
        nextStep.delayMinutes * 60 * 1000,
        internal.automations.sequences.processSequenceEnrollment,
        { enrollmentId: enrollment._id },
      );
    }

    return null;
  },
});
