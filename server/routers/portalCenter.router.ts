import { z } from "zod";
import { normalizePhone, phoneVariants } from "@shared/phone";
import * as bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { adminProcedure } from "../middleware/auth";
import { phoneSchema, idSchema } from "./schemas";
import { FEATURES, isKnownFeature } from "@shared/customerFeatures";
import { DEFAULT_RESET_PASSWORD } from "@shared/resetPassword";
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
  /* ── features handed to one customer at a time ────────────────────── */

  /** The catalogue, so the screen names a feature the same way everywhere. */
  listFeatures: adminProcedure.query(() => FEATURES),

  /** Who currently holds a given feature. */
  listFeatureGrants: adminProcedure
    .input(z.object({ feature: z.string().max(64) }))
    .query(async ({ input }) => {
      if (!isKnownFeature(input.feature)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "تایبەتمەندی نەناسراو" });
      }
      return db.getCustomersWithFeature(input.feature);
    }),

  /**
   * Give it to a customer.
   *
   * The feature id is checked against the catalogue rather than trusted: a
   * typo would otherwise write a row that grants nothing and reads, on the
   * screen, exactly like a row that grants something.
   */
  grantFeature: adminProcedure
    .input(z.object({
      customerId: idSchema,
      feature: z.string().max(64),
      note: z.string().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!isKnownFeature(input.feature)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "تایبەتمەندی نەناسراو" });
      }
      await db.grantCustomerFeature(input.customerId, input.feature, ctx.user.id, input.note);
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "grant_customer_feature",
        entityType: "customer",
        entityId: input.customerId,
        newValues: { feature: input.feature, note: input.note },
      });
      return { success: true };
    }),

  revokeFeature: adminProcedure
    .input(z.object({ customerId: idSchema, feature: z.string().max(64) }))
    .mutation(async ({ input, ctx }) => {
      await db.revokeCustomerFeature(input.customerId, input.feature);
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "revoke_customer_feature",
        entityType: "customer",
        entityId: input.customerId,
        oldValues: { feature: input.feature },
      });
      return { success: true };
    }),
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

        /**
         * What the office actually needs when somebody rings up unable to
         * sign in.
         *
         * The password itself cannot be shown: it is bcrypt-hashed, which is
         * one-way on purpose, and keeping a readable copy would mean one
         * database leak exposing every customer's password — and, because
         * people reuse them, their other accounts too.
         *
         * These two answer the question behind the question. If the account
         * is still on the password we handed out, read it back to them. If
         * they chose their own, nobody can recover it and a reset is the
         * answer — which is one tap away on this same panel.
         */
        passwordChangedAt: c.passwordChangedAt ?? null,
        isOnDefaultPassword: c.passwordHash
          ? await bcrypt.compare(DEFAULT_RESET_PASSWORD, c.passwordHash)
          : false,
      };
    }),

  /**
   * "This customer says they cannot sign in." Answers why, in one call.
   *
   * There are four ways the portal login refuses, and two of them print the
   * same sentence — "wrong phone number or password" covers both "no account
   * with that number" and "that password does not match". So staff reset the
   * password, the customer still cannot get in, staff reset it again, and
   * nobody learns anything. That has cost real afternoons.
   *
   * This walks the exact path the login walks, with the number as the
   * customer would type it, and reports which step fails. Optionally checks a
   * password too, which is the only way to tell the two identical messages
   * apart.
   *
   * Admin-only and audit-logged. It reveals no hash and grants nothing an
   * admin could not already do by resetting the password — it only replaces
   * guessing with an answer.
   */
  diagnoseCustomerLogin: adminProcedure
    .input(z.object({
      mobileNumber: z.string().min(1).max(30),
      password: z.string().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const typed = input.mobileNumber.trim();

      const customer = await db.getCustomerByMobile(typed);
      if (!customer) {
        return {
          step: "no_account" as const,
          normalized: normalizePhone(typed),
          triedVariants: phoneVariants(typed),
          message: "هیچ کڕیارێک بەم ژمارەیە نەدۆزرایەوە — نە بە سفرەوە و نە بەبێ سفر.",
        };
      }

      const found = {
        id: customer.id,
        customerCode: customer.customerCode,
        fullName: customer.fullName,
        storedNumber: customer.mobileNumber,
        // The number is stored one way and typed another far more often than
        // anyone expects; say so plainly when it happens.
        storedDiffersFromTyped: customer.mobileNumber !== typed,
      };

      if (!customer.isActive) {
        return { step: "inactive" as const, found, message: "هەژمارەکە ناچالاکە — چالاکی بکە." };
      }

      if (!customer.passwordHash) {
        return {
          step: "no_password" as const,
          found,
          message: "هیچ وشەیەکی نهێنی بۆ ئەم هەژمارە دانەنراوە — ڕیسێتی بکە.",
        };
      }

      if (input.password === undefined) {
        return {
          step: "reaches_password" as const,
          found,
          message: "ژمارەکە دۆزرایەوە، هەژمارەکە چالاکە و وشەی نهێنی دانراوە. وشەکە بنووسە بۆ تاقیکردنەوەی.",
        };
      }

      const matches = await bcrypt.compare(input.password, customer.passwordHash);

      // Recorded because it is a password check on somebody else's account,
      // even though it changes nothing.
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "diagnose_customer_login",
        entityType: "customer",
        entityId: customer.id,
      });

      return {
        step: matches ? ("ok" as const) : ("wrong_password" as const),
        found,
        message: matches
          ? "ئەم وشەیە کاردەکات. ئەگەر موشتەری هێشتا ناتوانێت بچێتە ژوورەوە، بۆشایی یان کاراکتەرێکی زیادەی تێدایە."
          : "ژمارەکە دروستە بەڵام ئەم وشەیە ناگونجێت — ڕیسێتی بکە.",
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
