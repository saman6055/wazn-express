import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure } from "../middleware/auth";
import * as db from "../db";

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
});
