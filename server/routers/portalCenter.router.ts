import { z } from "zod";
import * as bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { adminProcedure } from "../middleware/auth";
import { phoneSchema } from "./schemas";
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
      // No actionUrl: a plain text notification has no destination, and a
      // generic "/portal" link renders a dead "View" button.
      await db.createCustomerNotification(buildNotif(input, {
        customerId: input.customerId, type: "info", relatedType: "package",
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
            customerId: c.id, type: "info", relatedType: "package",
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

  // ---- Security & access (admin control over customer login) ----
  // NOTE: passwords are stored as one-way bcrypt hashes and can never be read
  // back — not here, not anywhere. Admin control works by RESETTING to a new
  // value the admin chooses (and sees at that moment), which gives full
  // control without ever storing a recoverable/plaintext password.
  getCustomerSecurity: adminProcedure
    .input(z.object({ customerId: z.number().int() }))
    .query(async ({ input }) => {
      const c = await db.getCustomerById(input.customerId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "کڕیار نەدۆزرایەوە" });
      return {
        id: c.id,
        customerCode: c.customerCode,
        fullName: c.fullName,
        mobileNumber: c.mobileNumber,
        isActive: c.isActive,
        lastSignedIn: c.lastSignedIn ?? null,
        hasPassword: !!c.passwordHash,
      };
    }),

  // Set a NEW password for the customer. The admin supplies (or generates) the
  // value client-side, sees it there, and can copy/WhatsApp it to the customer.
  resetCustomerPassword: adminProcedure
    .input(z.object({
      customerId: z.number().int(),
      newPassword: z.string().min(6).max(100),
      notifyCustomer: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const customer = await db.getCustomerById(input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "کڕیار نەدۆزرایەوە" });

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await db.updateCustomerPassword(input.customerId, passwordHash);
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "reset_customer_password",
        entityType: "customer",
        entityId: input.customerId,
      });
      await db.logCustomerActivity({
        customerId: input.customerId,
        action: "admin_reset_password",
        category: "auth",
        metadata: { by: ctx.user.id },
      });
      // Transparency: tell the customer their password was changed by support.
      if (input.notifyCustomer) {
        try {
          await db.createCustomerNotification(buildNotif({
            title: "وشەی نهێنی گۆڕدرا",
            message: "وشەی نهێنیت لەلایەن پشتگیرییەوە نوێکرایەوە. ئەگەر خۆت داوات نەکردبوو، پەیوەندیمان پێوە بکە.",
          }, { customerId: input.customerId, type: "warning", relatedType: "package" }), { push: true });
        } catch { /* notification is best-effort */ }
      }
      return { success: true };
    }),

  // Change the customer's login mobile number (their username). Enforces the
  // same uniqueness the customers table requires.
  updateCustomerMobile: adminProcedure
    .input(z.object({ customerId: z.number().int(), mobileNumber: phoneSchema }))
    .mutation(async ({ input, ctx }) => {
      const customer = await db.getCustomerById(input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "کڕیار نەدۆزرایەوە" });

      const existing = await db.getCustomerByMobile(input.mobileNumber);
      if (existing && existing.id !== input.customerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ئەم ژمارەیە پێشتر بۆ کڕیارێکی تر تۆمارکراوە" });
      }

      await db.updateCustomer(input.customerId, { mobileNumber: input.mobileNumber });
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "update_customer_mobile",
        entityType: "customer",
        entityId: input.customerId,
        newValues: { mobileNumber: input.mobileNumber },
      });
      return { success: true };
    }),

  // Enable / disable portal access for a customer.
  setCustomerActive: adminProcedure
    .input(z.object({ customerId: z.number().int(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const customer = await db.getCustomerById(input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "کڕیار نەدۆزرایەوە" });

      await db.updateCustomer(input.customerId, { isActive: input.isActive });
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: input.isActive ? "activate_customer" : "deactivate_customer",
        entityType: "customer",
        entityId: input.customerId,
      });
      return { success: true };
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

  // ---- Wazn News (social channels + ticker) ----
  getNewsSettings: adminProcedure.query(async () => {
    return db.getWaznNewsSettings();
  }),

  setNewsSettings: adminProcedure
    .input(z.object({
      tickerEnabled: z.boolean(),
      youtube: z.string().max(300).default(""),
      telegram: z.string().max(300).default(""),
      tiktok: z.string().max(300).default(""),
      instagram: z.string().max(300).default(""),
      facebook: z.string().max(300).default(""),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.setWaznNewsSettings(input, ctx.user.id);
      return { ok: true };
    }),

  // ---- Yuan exchange (portal "buy CNY" section) ----
  getYuanSettings: adminProcedure.query(async () => {
    return db.getYuanExchangeSettings();
  }),

  setYuanSettings: adminProcedure
    .input(z.object({
      enabled: z.boolean(),
      rate: z.number().positive().max(1000),
      minUsd: z.number().positive().nullable(),
      maxUsd: z.number().positive().nullable(),
      noteKu: z.string().max(500).default(""),
      noteEn: z.string().max(500).default(""),
      noteAr: z.string().max(500).default(""),
      noteZh: z.string().max(500).default(""),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.setYuanExchangeSettings(input, ctx.user.id);
      return { ok: true };
    }),

  listYuanOrders: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "processing", "completed", "cancelled"]).optional(),
      limit: z.number().int().min(1).max(200).default(100),
    }))
    .query(async ({ input }) => {
      return db.listYuanExchangeOrders(input);
    }),

  countPendingYuanOrders: adminProcedure.query(async () => {
    return db.countPendingYuanOrders();
  }),

  updateYuanOrderStatus: adminProcedure
    .input(z.object({
      id: z.number().int(),
      status: z.enum(["pending", "processing", "completed", "cancelled"]),
      adminNote: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const order = await db.updateYuanExchangeOrder(input.id, {
        status: input.status,
        adminNote: input.adminNote?.trim() ? input.adminNote.trim() : null,
        handledById: ctx.user.id,
      });
      if (!order) return { ok: false };

      // Tell the customer — stored notification + live SSE toast + web push.
      const statusText: Record<string, { title: string; message: string }> = {
        pending: {
          title: "داواکاری یوان — چاوەڕوانە",
          message: `داواکاری یوانەکەت ($${order.usdAmount} → ¥${order.cnyAmount}) لە لیستی چاوەڕوانیدایە`,
        },
        processing: {
          title: "داواکاری یوان — جێبەجێدەکرێت",
          message: `داواکاری یوانەکەت ($${order.usdAmount} → ¥${order.cnyAmount}) لە جێبەجێکردندایە`,
        },
        completed: {
          title: "داواکاری یوان — تەواوبوو ✅",
          message: `داواکاری یوانەکەت ($${order.usdAmount} → ¥${order.cnyAmount}) بە سەرکەوتوویی تەواوبوو`,
        },
        cancelled: {
          title: "داواکاری یوان — هەڵوەشایەوە",
          message: `داواکاری یوانەکەت ($${order.usdAmount} → ¥${order.cnyAmount}) هەڵوەشایەوە${input.adminNote ? ` — ${input.adminNote}` : ""}`,
        },
      };
      const txt = statusText[input.status];
      try {
        await db.createCustomerNotification(buildNotif(txt, {
          customerId: order.customerId,
          type: input.status === "completed" ? "success" : input.status === "cancelled" ? "error" : "info",
          actionUrl: "/portal/yuan-exchange",
        }));
      } catch {
        // Notification is best-effort; the status change itself already saved.
      }
      return { ok: true, order };
    }),
});
