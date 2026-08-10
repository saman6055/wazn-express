import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";
import * as db from "../db";

/**
 * A portal request, with the customer it belongs to already worked out.
 *
 * Every one of the forty-odd portal endpoints opened with the same two lines —
 * is the signed-in user a customer, or a staff account with a customer profile
 * hanging off it — and then each decided for itself what to do when the answer
 * was nobody. Fourteen returned an empty list, five null, three zero, three an
 * object with a false in it, and seven threw: some BAD_REQUEST, some NOT_FOUND,
 * some FORBIDDEN.
 *
 * For the customer that meant one problem wearing seven faces. The same broken
 * account showed an empty shipments page on one screen, a red error on the
 * next, and on a third bounced them out to the login — because the global
 * redirect-on-auth-error subscriber reads FORBIDDEN as "your session died".
 * Support cannot recognise a fault that never looks the same twice.
 *
 * One answer now, and it is the honest one: the user is signed in, they simply
 * have no customer profile. BAD_REQUEST, because FORBIDDEN is what throws them
 * out of a session that is perfectly valid.
 */
export const customerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const customerId = ctx.user.isCustomer
    ? ctx.user.id
    : (await db.getCustomerByUserId(ctx.user.id))?.id;

  if (!customerId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "پرۆفایلی کڕیار نەدۆزرایەوە بۆ ئەم هەژمارە. تکایە پەیوەندی بە پشتگیرییەوە بکە.",
    });
  }

  return next({ ctx: { ...ctx, customerId } });
});

export const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["super_admin", "admin", "employee", "accountant"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Staff access required" });
  }
  return next({ ctx });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Super admin access required" });
  }
  return next({ ctx });
});

export const accountantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["super_admin", "admin", "accountant"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accountant access required" });
  }
  return next({ ctx });
});
