import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "../middleware/auth";
import * as db from "../db";
import { runMigration } from "../services/migration.service";
import { getConfig } from "../config";
import { phoneSchema, emailSchema, idSchema } from "./schemas";
import * as bcrypt from "bcryptjs";
import { appLogger } from "../utils/logger";

export const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  customerLogin: publicProcedure
    .input(z.object({
      mobileNumber: phoneSchema,
      password: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      const customer = await db.getCustomerByMobile(input.mobileNumber);
      if (!customer) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە" });
      }
      if (!customer.isActive) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ئەکاونتەکە ناچالاکە" });
      }
      if (!customer.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "وشەی نهێنی دانەنراوە" });
      }
      const isValid = await bcrypt.compare(input.password, customer.passwordHash);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە" });
      }
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(getConfig().jwtSecret);
      const token = await new SignJWT({
        customerId: customer.id,
        customerCode: customer.customerCode,
        role: "customer",
        isCustomer: true,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(secret);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
      return {
        success: true,
        customer: { id: customer.id, name: customer.fullName, customerCode: customer.customerCode },
      };
    }),
  staffLogin: publicProcedure
    .input(z.object({
      identifier: z.string().min(1).max(255),
      password: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const isMobile = /^[0-9+\-\s]+$/.test(input.identifier) && input.identifier.length >= 10;
        let user = await db.getUserByUsername(input.identifier);
        if (!user && isMobile) user = await db.getUserByMobile(input.identifier);
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ئیمەیڵ/ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە" });
        }
        if (!user.isActive) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ئەکاونتەکە ناچالاکە" });
        }
        if (!user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "وشەی نهێنی دانەنراوە. تکایە پەیوەندی بکە بە ئەدمین" });
        }
        const isValid = await bcrypt.compare(input.password, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە" });
        }
        const { SignJWT } = await import("jose");
        const secret = new TextEncoder().encode(getConfig().jwtSecret);
        const token = await new SignJWT({
          userId: user.id,
          openId: user.openId || `staff_${user.id}`,
          role: user.role,
          isStaff: true,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("24h")
          .sign(secret);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });
        try {
          await db.updateUserLastSignIn(user.id);
        } catch (_) {
          // Non-critical: don't fail login if lastSignIn update fails
        }
        return { success: true, user: { id: user.id, name: user.name, role: user.role } };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        appLogger.error("staffLogin failed", { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "هەڵەیەک ڕوویدا. دووبارە هەوڵ بدەرەوە یان پەیوەندی بکە بە بەڕێوەبەر." });
      }
    }),
  registerStaff: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      username: z.string().min(3).max(100).optional(),
      email: emailSchema.optional(),
      mobileNumber: phoneSchema.optional(),
      password: z.string().min(6).max(500),
      role: z.enum(["admin", "employee", "accountant"]),
    }))
    .mutation(async ({ input }) => {
      if (!input.username && !input.email && !input.mobileNumber) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "دەبێت یوزەرنەیم، ئیمەیڵ یان ژمارەی مۆبایل دابنێیت" });
      }
      if (input.username) {
        const existingByUsername = await db.getUserByUsername(input.username);
        if (existingByUsername) throw new TRPCError({ code: "CONFLICT", message: "بەکارهێنەرێک بەم یوزەرنەیمە پێشتر هەیە" });
      }
      if (input.email) {
        const existingByEmail = await db.getUserByUsername(input.email);
        if (existingByEmail) throw new TRPCError({ code: "CONFLICT", message: "بەکارهێنەرێک بەم ئیمەیڵە پێشتر هەیە" });
      }
      if (input.mobileNumber) {
        const existingByMobile = await db.getUserByMobile(input.mobileNumber);
        if (existingByMobile) throw new TRPCError({ code: "CONFLICT", message: "بەکارهێنەرێک بەم ژمارەی مۆبایلە پێشتر هەیە" });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await db.createStaffUser({
        name: input.name,
        username: input.username,
        email: input.email,
        mobileNumber: input.mobileNumber,
        passwordHash,
        role: input.role,
      });
      return { success: true, user };
    }),
  resetStaffPassword: adminProcedure
    .input(z.object({ userId: idSchema, newPassword: z.string().min(6).max(500) }))
    .mutation(async ({ input }) => {
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await db.updateUserPassword(input.userId, passwordHash);
      return { success: true };
    }),
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1).max(500),
      newPassword: z.string().min(6).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change password" });
      }
      const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await db.updateUserPassword(ctx.user.id, passwordHash);
      return { success: true };
    }),
  getStaffList: adminProcedure.query(async () => db.getAllStaff()),
  toggleStaffStatus: adminProcedure
    .input(z.object({ userId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.updateUserStatus(input.userId, input.isActive);
      return { success: true };
    }),
  deleteStaff: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot delete your own account" });
      }
      const targetUser = await db.getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (ctx.user.role === "admin") {
        if (targetUser.role === "admin" || targetUser.role === "super_admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admin can only delete employees and accountants" });
        }
      }
      await db.deleteStaffUser(input.userId);
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "delete_staff",
        entityType: "user",
        entityId: input.userId,
        description: `Deleted staff: ${targetUser.name} (${targetUser.role})`,
      });
      return { success: true, deletedUser: targetUser.name };
    }),
});
