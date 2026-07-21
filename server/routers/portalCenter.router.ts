import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure } from "../middleware/auth";
import * as db from "../db";

const ANNOUNCEMENT_KEY = "portal_announcement";

// A localized notification body: the admin types one text; we mirror it into
// every language field so it displays regardless of the viewer's locale.
const notifTextInput = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
});
function buildNotif(input: { title: string; message: string }, extra: Record<string, unknown>) {
  return {
    title: input.title, titleKu: input.title, titleAr: input.title,
    message: input.message, messageKu: input.message, messageAr: input.message,
    ...extra,
  } as any;
}

// ---------------------------------------------------------------------------
// Customer Portal Center — ADMIN observability router.
// Read-only aggregation over customer-authored data + the activity log. Admin
// only; does not touch any business logic. See server/db/portalCenter.db.ts.
// ---------------------------------------------------------------------------

const pagination = {
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
};

export const portalCenterRouter = router({
  getOverview: adminProcedure.query(async () => {
    return db.getPortalCenterOverview();
  }),

  listCustomers: adminProcedure
    .input(z.object({ search: z.string().optional(), ...pagination }))
    .query(async ({ input }) => {
      return db.listPortalCustomers(input);
    }),

  getCustomerTimeline: adminProcedure
    .input(z.object({ customerId: z.number().int(), limit: z.number().int().min(1).max(500).default(150) }))
    .query(async ({ input }) => {
      return db.getCustomerActivityTimeline(input.customerId, input.limit);
    }),

  getActivityFeed: adminProcedure
    .input(z.object({
      customerId: z.number().int().optional(),
      category: z.enum(["auth", "navigation", "declaration", "claim", "message", "search", "profile", "other"]).optional(),
      ...pagination,
    }))
    .query(async ({ input }) => {
      return db.getActivityFeed(input);
    }),

  listDeliveryRatings: adminProcedure
    .input(z.object({ ...pagination }))
    .query(async ({ input }) => {
      return db.listDeliveryRatings(input);
    }),

  listDeclaredPackages: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["pending", "matched", "received", "cancelled"]).optional(),
      ...pagination,
    }))
    .query(async ({ input }) => {
      return db.listDeclaredPackagesWithCustomer(input);
    }),

  listClaimRequests: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      ...pagination,
    }))
    .query(async ({ input }) => {
      return db.listClaimRequestsWithCustomer(input);
    }),

  // ---- Messaging (inbox + reply) ----
  listConversations: adminProcedure.query(async () => {
    return db.getAllConversations();
  }),

  getConversation: adminProcedure
    .input(z.object({ customerId: z.number().int() }))
    .query(async ({ input }) => {
      return db.getConversationMessages(`CONV-${input.customerId}`);
    }),

  markConversationRead: adminProcedure
    .input(z.object({ customerId: z.number().int() }))
    .mutation(async ({ input }) => {
      await db.markCustomerMessagesAsRead(input.customerId, "customer");
      return { ok: true };
    }),

  replyToCustomer: adminProcedure
    .input(z.object({ customerId: z.number().int(), message: z.string().min(1).max(4000) }))
    .mutation(async ({ input, ctx }) => {
      const msg = await db.createCustomerMessage({
        conversationId: `CONV-${input.customerId}`,
        customerId: input.customerId,
        message: input.message,
        senderType: "admin",
        senderId: ctx.user.id,
      });
      // Let the customer know they have a reply (in-app + SSE).
      await db.createCustomerNotification(buildNotif(
        { title: "New reply from support", message: input.message.slice(0, 160) },
        { customerId: input.customerId, type: "message", relatedType: "package", actionUrl: "/portal/messages" },
      ));
      return msg;
    }),

  // ---- Notifications (personal + broadcast) ----
  sendNotificationToCustomer: adminProcedure
    .input(z.object({ customerId: z.number().int(), withPush: z.boolean().default(true) }).and(notifTextInput))
    .mutation(async ({ input, ctx }) => {
      // createCustomerNotification auto-pushes; withPush maps to its opt-out.
      await db.createCustomerNotification(buildNotif(input, {
        customerId: input.customerId, type: "info", relatedType: "package", actionUrl: "/portal",
      }), { push: input.withPush });
      await db.logCustomerActivity({
        customerId: input.customerId, action: "admin_notification", category: "other",
        detail: input.title, metadata: { by: ctx.user.id },
      });
      return { ok: true };
    }),

  broadcastNotification: adminProcedure
    .input(z.object({ withPush: z.boolean().default(false) }).and(notifTextInput))
    .mutation(async ({ input }) => {
      const customers = await db.getAllCustomers(true); // active only
      let sent = 0;
      for (const c of customers as { id: number }[]) {
        try {
          await db.createCustomerNotification(buildNotif(input, {
            customerId: c.id, type: "info", relatedType: "package", actionUrl: "/portal",
          }), { push: input.withPush });
          sent++;
        } catch { /* skip one, keep going */ }
      }
      return { ok: true, sent };
    }),

  // ---- Internal notes ----
  listNotes: adminProcedure
    .input(z.object({ customerId: z.number().int() }))
    .query(async ({ input }) => {
      return db.listCustomerAdminNotes(input.customerId);
    }),

  addNote: adminProcedure
    .input(z.object({ customerId: z.number().int(), note: z.string().min(1).max(2000) }))
    .mutation(async ({ input, ctx }) => {
      await db.addCustomerAdminNote({
        customerId: input.customerId,
        note: input.note,
        createdById: ctx.user.id,
        createdByName: (ctx.user as any).name ?? null,
      });
      return { ok: true };
    }),

  // ---- Portal announcement banner ----
  getAnnouncement: adminProcedure.query(async () => {
    const raw = await db.getSetting(ANNOUNCEMENT_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }),

  setAnnouncement: adminProcedure
    .input(z.object({
      enabled: z.boolean(),
      type: z.enum(["info", "warning", "success"]).default("info"),
      ku: z.string().max(500).default(""),
      en: z.string().max(500).default(""),
      ar: z.string().max(500).default(""),
      zh: z.string().max(500).default(""),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.setSetting(ANNOUNCEMENT_KEY, JSON.stringify(input), ctx.user.id);
      return { ok: true };
    }),
});
