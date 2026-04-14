/**
 * Combined app router - imports and merges all feature routers.
 */
import { router } from "../_core/trpc";
import { authRouter } from "./auth.router";
import { adminRouters } from "./admin.router";
import { customersRouters } from "./customers.router";
import { batchesRouter } from "./batches.router";
import { packagesRouter } from "./packages.router";
import { invoicesRouters } from "./invoices.router";
import { financeRouters } from "./finance.router";
import { reportsRouter } from "./reports.router";
import { customerPortalRouter } from "./portal.router";
import { settingsRouters } from "./settings.router";
import { fullPackageRouter } from "./fullPackage.router";
import { scanningRouters } from "./scanning.router";
import { servicesRouters } from "./services.router";
import { productAttributesRouter } from "./productAttributes.router";

export const appRouter = router({
  ...adminRouters,
  auth: authRouter,
  ...customersRouters,
  batches: batchesRouter,
  packages: packagesRouter,
  ...invoicesRouters,
  ...financeRouters,
  reports: reportsRouter,
  customerPortal: customerPortalRouter,
  ...settingsRouters,
  fullPackage: fullPackageRouter,
  ...scanningRouters,
  ...servicesRouters,
  productAttributes: productAttributesRouter,
});

export type AppRouter = typeof appRouter;
