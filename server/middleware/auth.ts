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

/**
 * The auditor is on both staff lists on purpose.
 *
 * It is here to read — the packages, the batches, the customers, the finance
 * figures — and a reader kept out of the data has nothing to audit. What stops
 * it changing anything is not this list; it is the single check in
 * server/_core/trpc.ts that every one of these procedures passes through
 * first. See shared/readOnlyRole.ts.
 */
export const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["super_admin", "admin", "employee", "accountant", "auditor"].includes(ctx.user.role)) {
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

/**
 * Admins, plus the read-only auditor.
 *
 * For anything an auditor genuinely needs and an ordinary staff account has
 * no business reading — the audit log above all. "Who changed this figure,
 * and when" is the first question asked about a number that looks wrong, and
 * an auditor locked out of the answer can only report that something is odd.
 *
 * Safe to widen because the read-only rule already refuses every mutation
 * before this runs (server/_core/trpc.ts), so this can only ever open reads.
 * It is not the same as making the auditor an admin: adminProcedure also
 * covers the staff list, which returns password hashes with every row.
 */
export const auditorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["super_admin", "admin", "auditor"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const accountantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["super_admin", "admin", "accountant", "auditor"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accountant access required" });
  }
  return next({ ctx });
});
