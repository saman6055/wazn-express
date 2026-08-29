/**
 * Combined app router - imports and merges all feature routers.
 */
import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import * as db from "../db";
import { authRouter } from "./auth.router";
import { adminRouters } from "./admin.router";
import { customersRouters } from "./customers.router";
import { batchesRouter } from "./batches.router";
import { trashRouter } from "./trash.router";
import { packagesRouter } from "./packages.router";
import { invoicesRouters } from "./invoices.router";
import { financeRouters } from "./finance.router";
import { reportsRouter } from "./reports.router";
import { customerPortalRouter, portalPriceListAdminRouter } from "./portal.router";
import { pushAdminRouter } from "./pushAdmin.router";
import { settingsRouters } from "./settings.router";
import { fullPackageRouter } from "./fullPackage.router";
import { scanningRouters } from "./scanning.router";
import { servicesRouters } from "./services.router";
import { productAttributesRouter } from "./productAttributes.router";
import { tutorialsRouter } from "./tutorials.router";
import { portalCenterRouter } from "./portalCenter.router";
import { storeRouter } from "./store.router";
import { prohibitedRouter } from "./prohibited.router";
import { auditRouter } from "./audit.router";

export const appRouter = router({
  /**
   * The one thing in this system anybody may read without an account.
   *
   * A customer sends a parcel to their brother, who has no login and should
   * not need one. He was given a link; it shows him that parcel and nothing
   * else — see shared/shareLink.ts for the exact view, which is an allow-list
   * rather than a strip-list so a new column is invisible by default.
   *
   * Every failure returns the same null. Distinguishing "no such link" from
   * "that link expired" would confirm which tokens exist, which is the only
   * useful thing an attacker could learn here.
   */
  publicTracking: router({
    get: publicProcedure
      .input(z.object({ token: z.string().min(10).max(64) }))
      .query(async ({ input }) => {
        return db.resolveShareLink(input.token);
      }),
  }),

  ...adminRouters,
  auth: authRouter,
  ...customersRouters,
  batches: batchesRouter,
  trash: trashRouter,
  packages: packagesRouter,
  ...invoicesRouters,
  ...financeRouters,
  reports: reportsRouter,
  customerPortal: customerPortalRouter,
  portalPriceList: portalPriceListAdminRouter,
  pushAdmin: pushAdminRouter,
  ...settingsRouters,
  fullPackage: fullPackageRouter,
  ...scanningRouters,
  ...servicesRouters,
  productAttributes: productAttributesRouter,
  tutorials: tutorialsRouter,
  portalCenter: portalCenterRouter,
  store: storeRouter,
  prohibited: prohibitedRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;
