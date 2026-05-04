import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure } from "../middleware/auth";
import * as db from "../db";
import { runPushCampaign, isPushEnabled, processDueScheduledCampaigns } from "../services/push.service";

const targetTypeSchema = z.enum(["all", "customer", "batch", "segment"]);
const segmentSchema = z.enum([
  "active_customers",
  "with_pending_packages",
  "with_unpaid_invoices",
  "vip_customers",
  "inactive_30d",
]);

const campaignContentSchema = z.object({
  titleKu: z.string().max(200).optional().nullable(),
  titleEn: z.string().max(200).optional().nullable(),
  titleAr: z.string().max(200).optional().nullable(),
  titleZh: z.string().max(200).optional().nullable(),
  bodyKu: z.string().max(2000).optional().nullable(),
  bodyEn: z.string().max(2000).optional().nullable(),
  bodyAr: z.string().max(2000).optional().nullable(),
  bodyZh: z.string().max(2000).optional().nullable(),
  url: z.string().max(500).optional().nullable(),
  targetType: targetTypeSchema,
  targetCustomerId: z.number().int().positive().optional().nullable(),
  targetBatchId: z.number().int().positive().optional().nullable(),
  targetSegment: segmentSchema.optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
}).refine((d) => {
  // Must have at least one language pair (title + body)
  const pairs = [
    !!d.titleKu && !!d.bodyKu,
    !!d.titleEn && !!d.bodyEn,
    !!d.titleAr && !!d.bodyAr,
    !!d.titleZh && !!d.bodyZh,
  ];
  return pairs.some(Boolean);
}, { message: "At least one language pair (title + body) is required" })
.refine((d) => {
  if (d.targetType === "customer") return !!d.targetCustomerId;
  if (d.targetType === "batch") return !!d.targetBatchId;
  if (d.targetType === "segment") return !!d.targetSegment;
  return true;
}, { message: "Target identifier is required for the chosen target type" });

export const pushAdminRouter = router({
  /**
   * Live runtime status — useful for an Admin UI banner ("Push is disabled until VAPID is set").
   */
  getStatus: adminProcedure.query(() => {
    return {
      enabled: isPushEnabled(),
      vapidConfigured: isPushEnabled(),
    };
  }),

  /**
   * Aggregate stats across subscriptions and campaigns.
   */
  getStats: adminProcedure.query(async () => {
    return await db.getPushCampaignStats();
  }),

  /**
   * Preview the audience size BEFORE creating a campaign so admins know how many
   * customers will receive it. Cheap — runs the same SQL the campaign will run.
   */
  previewAudience: adminProcedure
    .input(z.object({
      targetType: targetTypeSchema,
      targetCustomerId: z.number().int().positive().optional().nullable(),
      targetBatchId: z.number().int().positive().optional().nullable(),
      targetSegment: segmentSchema.optional().nullable(),
    }))
    .query(async ({ input }) => {
      const customerIds = await db.resolvePushTargetCustomerIds(input);
      return { count: customerIds.length };
    }),

  /**
   * Create a new campaign. If `scheduledAt` is in the past or omitted, the
   * caller is expected to immediately call `runNow`. Otherwise it sits in
   * "scheduled" status until the cron picks it up.
   */
  createCampaign: adminProcedure
    .input(campaignContentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!isPushEnabled()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Push notifications are not configured (VAPID keys missing)" });
      }
      const isScheduled = input.scheduledAt && input.scheduledAt.getTime() > Date.now();
      const campaign = await db.createPushCampaign({
        ...input,
        status: isScheduled ? "scheduled" : "draft",
        createdById: ctx.user.id,
      });
      if (!campaign) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create campaign" });
      return campaign;
    }),

  /**
   * Send an existing draft/scheduled campaign immediately.
   */
  runNow: adminProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const result = await runPushCampaign(input.campaignId);
      if (!result.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Campaign run failed" });
      }
      return result;
    }),

  /**
   * Convenience: create a campaign + run it in one step (Compose → "Send Now").
   */
  composeAndSend: adminProcedure
    .input(campaignContentSchema)
    .mutation(async ({ ctx, input }) => {
      if (!isPushEnabled()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Push notifications are not configured (VAPID keys missing)" });
      }
      const campaign = await db.createPushCampaign({
        ...input,
        scheduledAt: null,
        status: "draft",
        createdById: ctx.user.id,
      });
      if (!campaign) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create campaign" });
      const result = await runPushCampaign(campaign.id);
      return { campaign, result };
    }),

  /**
   * Cancel a not-yet-sent campaign (draft or scheduled only).
   */
  cancelCampaign: adminProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const c = await db.getPushCampaignById(input.campaignId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      if (c.status !== "draft" && c.status !== "scheduled") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Cannot cancel a campaign with status "${c.status}"` });
      }
      await db.updatePushCampaign(input.campaignId, { status: "cancelled" });
      return { success: true };
    }),

  /**
   * History list — paginated.
   */
  listCampaigns: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
      status: z.enum(["draft", "scheduled", "sending", "completed", "failed", "cancelled"]).optional(),
    }))
    .query(async ({ input }) => {
      return await db.listPushCampaigns(input);
    }),

  getCampaignDetails: adminProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const c = await db.getPushCampaignById(input.campaignId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      return c;
    }),

  /**
   * Manual scheduler tick — exposed for an "Run scheduled now" button on the
   * admin page (debug/recovery). Normally handled by node-cron in the background.
   */
  processDue: adminProcedure.mutation(async () => {
    return await processDueScheduledCampaigns();
  }),
});
