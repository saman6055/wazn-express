/**
 * Combined app router - imports and merges all feature routers.
 */
import { router } from "../_core/trpc";
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
