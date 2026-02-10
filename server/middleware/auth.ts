import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";

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

export const accountantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["super_admin", "admin", "accountant"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accountant access required" });
  }
  return next({ ctx });
});
