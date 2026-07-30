import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";

export const reportsRouter = router({
    revenue: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getRevenueByDateRange(input.startDate, input.endDate);
      }),
    packagesByStatus: staffProcedure.query(async () => {
      return db.getPackageCountByStatus();
    }),
    /** Which shops the buying happens on — orders, units, value and profit. */
    ordersByPlatform: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getOrdersByPlatform(input?.startDate, input?.endDate);
      }),
    customersWithBalance: accountantProcedure.query(async () => {
      return db.getCustomersWithBalance();
    }),
    profitReport: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getProfitReport(input.startDate, input.endDate);
      }),
    topCustomers: staffProcedure
      .input(z.object({ limit: z.number().default(10) }).optional())
      .query(async ({ input }) => {
        return db.getTopCustomersByRevenue(input?.limit || 10);
      }),
    // Self orders: packages the customer bought themselves (no commission /
    // full-package order) — we only ship. Read-only rollup for reporting.
    selfOrderReport: staffProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getSelfOrderReport(input?.days);
      }),
    customersWithDebt: accountantProcedure.query(async () => {
      return db.getCustomersWithDebt();
    }),
    packageStats: staffProcedure.query(async () => {
      return db.getPackageStatsByStatus();
    }),
    timePeriodSummary: staffProcedure
      .input(z.object({ period: z.enum(["day", "week", "month"]) }))
      .query(async ({ input }) => {
        return db.getTimePeriodSummary(input.period);
      }),
    batchPerformance: staffProcedure.query(async () => {
      return db.getBatchPerformanceReport();
    }),
    getProfitByType: accountantProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getProfitByOrderType(input?.startDate, input?.endDate);
      }),
});

