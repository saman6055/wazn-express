import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { appLogger } from "../utils/logger";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { cacheGetOrSet, CACHE_TTL } from "../db/cache";
import { notifyPackageStatusChange } from "../services/notification.service";
import type { InsertPackage, InsertFullPackageOrder } from "../../drizzle/schema";
import { fullPackageOrders, fullPackageOrderTrackings, packages } from "../../drizzle/schema";
import { signQrData, verifyQrSignature } from "../utils/qr";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";

export const packagesRouter = router({
    list: staffProcedure
      .input(z.object({
        page: z.number().int().min(0).optional(),
        pageSize: z.number().int().positive().max(10000).optional(),
        search: z.string().max(200).optional(),
        status: z.string().max(50).optional(),
        shippingType: z.string().max(50).optional(),
        batchId: idSchema.optional(),
        customerId: idSchema.optional(),
        dateFrom: z.string().max(50).optional(),
        dateTo: z.string().max(50).optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllPackages({
          page: input?.page,
          pageSize: input?.pageSize,
          search: input?.search,
          status: input?.status,
          shippingType: input?.shippingType,
          batchId: input?.batchId,
          customerId: input?.customerId,
          dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
        });
      }),
    /**
     * Clear photo URLs whose files no longer exist on disk.
     *
     * Admin-only and dry-run by default: `apply` has to be sent explicitly,
     * so a mis-click reports rather than deletes. Only files in our own
     * uploads directory are ever touched.
     */
    cleanupDeadPhotos: adminProcedure
      .input(z.object({ apply: z.boolean().default(false) }).optional())
      .mutation(async ({ input, ctx }) => {
        const apply = input?.apply === true;
        const result = await db.cleanupDeadPhotoUrls({ dryRun: !apply });

        if (apply && result.removedPhotos > 0) {
          await db.createAuditLog({
            userId: ctx.user.id,
            userRole: ctx.user.role,
            action: "cleanup_dead_photos",
            entityType: "package",
            entityId: 0,
            newValues: {
              affectedPackages: result.affectedPackages,
              removedPhotos: result.removedPhotos,
              emptiedPackages: result.emptiedPackages,
            },
          });
        }
        return result;
      }),

    /** Quick Register intake for a period, with every photo and the owning order. */
    registrations: staffProcedure
      .input(z.object({
        dateFrom: z.string().max(50),
        dateTo: z.string().max(50),
        search: z.string().max(200).optional(),
        limit: z.number().int().positive().max(2000).optional(),
      }))
      .query(async ({ input }) => {
        return db.getRegistrations({
          from: new Date(input.dateFrom),
          to: new Date(input.dateTo),
          search: input.search,
          limit: input.limit,
        });
      }),

    stats: staffProcedure
      .query(async () => {
        return cacheGetOrSet("packages:stats", CACHE_TTL.DASHBOARD_STATS_MS, () => db.getPackagesStats());
      }),
    recentPackages: staffProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getRecentPackages(input?.limit || 10);
      }),
    getById: staffProcedure
      .input(z.object({ id: idSchema }))
      .query(async ({ input }) => {
        return db.getPackageById(input.id);
      }),
    getByCode: staffProcedure
      .input(z.object({ code: packageCodeSchema }))
      .query(async ({ input }) => {
        return db.getPackageByCode(input.code);
      }),
    getByCustomer: staffProcedure
      .input(z.object({ customerId: idSchema }))
      .query(async ({ input }) => {
        return db.getPackagesByCustomer(input.customerId);
      }),
    getByStatus: staffProcedure
      .input(z.object({ status: z.string().max(50) }))
      .query(async ({ input }) => {
        return db.getPackagesByStatus(input.status);
      }),
    // Lookup tracking number to identify package type (regular/full_package/commission)
    lookupTracking: staffProcedure
      .input(z.object({ trackingNumber: z.string().min(1).max(100) }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        // Check if tracking exists in fullPackageOrders (single tracking field)
        let order = await database.select({
          id: fullPackageOrders.id,
          orderCode: fullPackageOrders.orderCode,
          orderType: fullPackageOrders.orderType,
          customerId: fullPackageOrders.customerId,
          productName: fullPackageOrders.productName,
          status: fullPackageOrders.status,
        }).from(fullPackageOrders)
          .where(eq(fullPackageOrders.trackingNumber, input.trackingNumber))
          .limit(1);

        // Also check fullPackageOrderTrackings table (multiple trackings per order)
        if (order.length === 0) {
          const trackingRow = await database.select({
            fullPackageOrderId: fullPackageOrderTrackings.fullPackageOrderId,
          }).from(fullPackageOrderTrackings)
            .where(eq(fullPackageOrderTrackings.trackingNumber, input.trackingNumber))
            .limit(1);

          if (trackingRow.length > 0) {
            order = await database.select({
              id: fullPackageOrders.id,
              orderCode: fullPackageOrders.orderCode,
              orderType: fullPackageOrders.orderType,
              customerId: fullPackageOrders.customerId,
              productName: fullPackageOrders.productName,
              status: fullPackageOrders.status,
            }).from(fullPackageOrders)
              .where(eq(fullPackageOrders.id, trackingRow[0].fullPackageOrderId))
              .limit(1);
          }
        }

        if (order.length > 0) {
          // Get customer info
          const customer = await db.getCustomerById(order[0].customerId);
          return {
            found: true as const,
            type: order[0].orderType as 'full_package' | 'commission',
            orderId: order[0].id,
            orderCode: order[0].orderCode,
            productName: order[0].productName,
            status: order[0].status,
            customerId: order[0].customerId,
            customerCode: customer?.customerCode || '',
            customerName: customer?.fullName || '',
          };
        }
        
        // Check if tracking already exists in packages (duplicate check)
        const existingPkg = await database.select({
          id: packages.id,
          packageCode: packages.packageCode,
        }).from(packages)
          .where(eq(packages.trackingNumber, input.trackingNumber))
          .limit(1);
        
        if (existingPkg.length > 0) {
          return {
            found: false as const,
            type: 'duplicate' as const,
            existingPackageCode: existingPkg[0].packageCode,
          };
        }

        return { found: false as const, type: 'regular' as const };
      }),

    /**
     * Expanded tracking lookup for the new BulkRegister / QuickRegister UX.
     *
     * Resolves four scenarios at once so the UI can render the right banner
     * without a second round-trip:
     *
     *   - "single"     — exactly one order, one tracking. Normal case.
     *   - "shared"     — multiple orders share this tracking number
     *                    (same physical carton holds items for N orders).
     *   - "multi"      — one order, but it has N tracking numbers
     *                    (one order spread across N cartons).
     *   - "duplicate"  — a package with this tracking already exists.
     *   - "regular"    — tracking is not in any FP/Commission order.
     *
     * For "shared" and "multi" the response includes every related order and
     * tracking, with per-tracking flags showing which cartons already have a
     * registered package, so the UI can show progress like "3/5 cartons in".
     *
     * The single-customer business invariant is also checked here: if the
     * sharing orders belong to >1 customer the response surfaces it as a
     * `customerMismatch` flag — the UI must block submit and ask staff to
     * fix the source data, since allowing it would let one customer be
     * charged for goods another customer takes home.
     */
    lookupTrackingExpanded: staffProcedure
      .input(z.object({ trackingNumber: z.string().min(1).max(100) }))
      .query(async ({ input }) => {
        const tn = input.trackingNumber.trim();

        // Duplicate-package short-circuit comes first so we never silently
        // overwrite a package row from a typo'd tracking entry.
        const existingPkg = await db.getPackageByTrackingNumber(tn);
        if (existingPkg) {
          return {
            case: "duplicate" as const,
            existingPackage: {
              id: existingPkg.id,
              packageCode: existingPkg.packageCode,
              trackingNumber: existingPkg.trackingNumber,
              status: existingPkg.status,
              registeredAt: existingPkg.registeredAt,
            },
          };
        }

        // Pull every order that this tracking maps to (covers both the new
        // multi-tracking table and the legacy single-tracking field).
        const sharingOrders = await db.getAllOrdersByTrackingNumber(tn);
        if (sharingOrders.length === 0) {
          return { case: "regular" as const };
        }

        // For each order, fan out to all of its trackings (multi-tracking case)
        // and collect customer + batch metadata.
        const ordersDetail = await Promise.all(
          sharingOrders.map(async (o) => {
            const trackings = await db.getOrderTrackings(o.id);
            const customer = o.customerId ? await db.getCustomerById(o.customerId) : null;
            const batch = o.batchId ? await db.getBatchById(o.batchId) : null;
            return {
              order: {
                id: o.id,
                orderCode: o.orderCode,
                orderType: o.orderType,
                orderNumber: (o as { orderNumber?: string | null }).orderNumber ?? null,
                // Shown beside the order on the scan screen so the operator can
                // see which shop it came from without opening the order.
                platform: (o as { platform?: string | null }).platform ?? null,
                productName: o.productName,
                productImage: (o as { productImage?: string | null }).productImage ?? null,
                quantity: o.quantity,
                status: o.status,
                customerId: o.customerId ?? null,
                batchId: o.batchId ?? null,
                trackingNumber: o.trackingNumber ?? null,
              },
              customer: customer
                ? { id: customer.id, customerCode: customer.customerCode, fullName: customer.fullName }
                : null,
              batch: batch ? { id: batch.id, batchCode: batch.batchCode, status: batch.status } : null,
              trackings: trackings.map((t) => ({
                id: t.id,
                trackingNumber: t.trackingNumber,
                cartonIndex: t.cartonIndex ?? 1,
              })),
            };
          })
        );

        // Bulk lookup: which of every tracking we just collected already has
        // a registered package? One query, then a Map for O(1) per-row hits.
        const allTrackingsSet = new Set<string>();
        for (const od of ordersDetail) {
          if (od.order.trackingNumber) allTrackingsSet.add(od.order.trackingNumber);
          for (const t of od.trackings) allTrackingsSet.add(t.trackingNumber);
        }
        const existingPackages = await db.getPackagesByTrackingNumbers(Array.from(allTrackingsSet));
        const packageByTracking = new Map<string, { id: number; packageCode: string; status: string; registeredAt: Date }>();
        for (const p of existingPackages) {
          if (p.trackingNumber) {
            packageByTracking.set(p.trackingNumber, {
              id: p.id,
              packageCode: p.packageCode,
              status: p.status,
              registeredAt: p.registeredAt,
            });
          }
        }

        // Single-customer rule check.
        const customerIdSet = new Set<number>();
        for (const od of ordersDetail) {
          if (od.order.customerId) customerIdSet.add(od.order.customerId);
        }
        const customerMismatch = customerIdSet.size > 1;

        // Multi-batch conflict: if the sharing orders are split across
        // different batches, register-into-batch from the package side will
        // be ambiguous; surface it so the UI can warn before submit.
        const batchIdSet = new Set<number>();
        for (const od of ordersDetail) {
          if (od.order.batchId) batchIdSet.add(od.order.batchId);
        }
        const batchConflict = batchIdSet.size > 1;

        // Decide the headline case the UI should render.
        const headlineCase: "single" | "shared" | "multi" =
          ordersDetail.length > 1
            ? "shared"
            : (ordersDetail[0].trackings.length > 1 ? "multi" : "single");

        return {
          case: headlineCase,
          orders: ordersDetail,
          existingPackages: Array.from(packageByTracking.entries()).map(([trackingNumber, p]) => ({ trackingNumber, ...p })),
          flags: {
            customerMismatch,
            batchConflict,
            // For "multi" — quick progress count for the badge "X/Y cartons in".
            cartonsRegistered: ordersDetail.length === 1
              ? ordersDetail[0].trackings.filter(t => packageByTracking.has(t.trackingNumber)).length
              : null,
            cartonsTotal: ordersDetail.length === 1 ? ordersDetail[0].trackings.length : null,
          },
        };
      }),

    // Get CBM divisor setting
    getCbmDivisor: staffProcedure
      .query(async () => {
        const value = await db.getSetting('cbm_divisor');
        return { divisor: value ? parseInt(value) : 6000 };
      }),
    
    // Set CBM divisor setting
    setCbmDivisor: adminProcedure
      .input(z.object({ divisor: z.number().min(1).max(99999) }))
      .mutation(async ({ input, ctx }) => {
        await db.setSystemSetting({
          key: 'cbm_divisor',
          value: input.divisor.toString(),
          type: 'number',
          description: 'CBM volumetric weight divisor for air shipping (default: 6000)',
          updatedById: ctx.user.id,
        });
        return { divisor: input.divisor };
      }),

    register: staffProcedure
      .input(z.object({
        customerId: idSchema.optional(), // Optional for unclaimed packages
        originWarehouseId: idSchema,
        isUnclaimed: z.boolean().optional(), // True if registering without customer
        trackingNumber: z.string().max(100).optional(),
        weightKg: z.string().max(50).optional(),
        lengthCm: z.string().max(50).optional(),
        widthCm: z.string().max(50).optional(),
        heightCm: z.string().max(50).optional(),
        volumeCbm: z.string().max(50).optional(), // Direct CBM input for sea shipping
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]),
        description: z.string().max(1000).optional(),
        photos: z.array(z.string().max(2048)).optional(),
        batchId: idSchema.optional(),
        categoryId: idSchema.optional(),
        fullPackageOrderId: idSchema.optional(), // Legacy: kept for backwards compat
        // New: every order this physical package should be linked to. Covers
        // both "shared tracking" (one carton, multiple orders) and the implicit
        // single-link case (one order). When omitted, falls back to
        // [fullPackageOrderId] if present, else no links.
        linkedOrderIds: z.array(idSchema).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const warehouse = await db.getWarehouseById(input.originWarehouseId);
        if (!warehouse) {
          throw new TRPCError({ code: "NOT_FOUND", message: "کۆگا نەدۆزرایەوە. تکایە کۆگایەک زیاد بکە یان هەڵبژێرە." });
        }
        const codePrefix = warehouse.codePrefix ?? "PKG";

        if (input.batchId != null) {
          const batch = await db.getBatchById(input.batchId);
          if (!batch) {
            throw new TRPCError({ code: "NOT_FOUND", message: "گرووپ/بەچ نەدۆزرایەوە. تکایە بەچێکی دروست هەڵبژێرە یان بە خاڵی بەچ پاک بکەرەوە." });
          }
        }

        if (input.categoryId != null) {
          const category = await db.getProductCategoryById(input.categoryId);
          if (!category) {
            throw new TRPCError({ code: "NOT_FOUND", message: "جۆری بەرهەم نەدۆزرایەوە. تکایە جۆرێکی دروست هەڵبژێرە یان بە خاڵی جۆر پاک بکەرەوە." });
          }
        }

        if (input.trackingNumber?.trim()) {
          const existing = await db.getPackageByTrackingNumber(input.trackingNumber.trim());
          if (existing) {
            throw new TRPCError({ code: "CONFLICT", message: "ئەم تراکینگە پێشتر تۆمار کراوە. ناتوانرێت دووبارە تۆماری بکەیت." });
          }
        }

        // ----- Resolve & validate linked orders -----
        // Caller may pass either the new linkedOrderIds[] or the legacy
        // single fullPackageOrderId. Normalize to one ordered, deduped list.
        const orderIdsRaw: number[] = input.linkedOrderIds && input.linkedOrderIds.length > 0
          ? input.linkedOrderIds
          : (input.fullPackageOrderId ? [input.fullPackageOrderId] : []);
        const linkedOrderIds = Array.from(new Set(orderIdsRaw));

        // Single-customer business rule:
        //   The package row carries one customerId. Linking it to orders that
        //   belong to different customers would mean charging customer B for a
        //   package that physically goes home with customer A. Reject before
        //   any insert touches the DB.
        let primaryOrder: Awaited<ReturnType<typeof db.getFullPackageOrderById>> | undefined;
        if (linkedOrderIds.length > 0) {
          const orders = await Promise.all(linkedOrderIds.map((id) => db.getFullPackageOrderById(id)));
          const missing = orders.findIndex((o) => !o);
          if (missing !== -1) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `ئۆردەری گرێدراو نەدۆزرایەوە (id=${linkedOrderIds[missing]})`,
            });
          }
          const customerIds = new Set<number>();
          for (const o of orders) {
            if (o?.customerId != null) customerIds.add(o.customerId);
          }
          if (customerIds.size > 1) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "ئۆردەرە گرێدراوەکان دەبێ هەر یەک کڕیاریان هەبێ. تکایە لە سەرچاوە چاکی بکەرەوە.",
            });
          }
          primaryOrder = orders[0]!;
        }

        // For unclaimed packages, customer is optional
        let customer = null;
        // If the staff omitted customerId but the linked order resolves one,
        // adopt it — keeps existing behavior of QuickRegister where the FP
        // order's customer is canonical.
        const effectiveCustomerId = input.customerId
          ?? (primaryOrder?.customerId ?? undefined);
        if (effectiveCustomerId && !input.isUnclaimed) {
          customer = await db.getCustomerById(effectiveCustomerId);
          if (!customer) {
            throw new TRPCError({ code: "NOT_FOUND", message: "کڕیار نەدۆزرایەوە. تکایە کڕیارێکی دروست هەڵبژێرە یان بێ خاوەن دیاری بکە." });
          }
        }

        // Calculate volume if dimensions provided, or use direct CBM input
        let volumeCbm: string | undefined;
        if (input.volumeCbm) {
          volumeCbm = parseFloat(input.volumeCbm).toFixed(6);
        } else if (input.lengthCm && input.widthCm && input.heightCm) {
          const vol = (parseFloat(input.lengthCm) * parseFloat(input.widthCm) * parseFloat(input.heightCm)) / 1000000;
          volumeCbm = vol.toFixed(6);
        }

        // Get applicable pricing
        const country = await db.getCountryById(warehouse.countryId);
        const destCountries = await db.getDestinationCountries();
        const destCountry = destCountries[0];
        
        let calculatedCostUsd: string | undefined;
        let appliedPricingRuleId: number | undefined;
        
        if (country && destCountry) {
          const pricingRule = await db.getApplicablePricingRule(
            country.id,
            destCountry.id,
            input.shippingType
          );
          
          if (pricingRule) {
            appliedPricingRuleId = pricingRule.id;
            const pricePerUnit = parseFloat(pricingRule.pricePerUnit);
            
            if (pricingRule.unit === "kg" && input.weightKg) {
              calculatedCostUsd = (pricePerUnit * parseFloat(input.weightKg)).toFixed(2);
            } else if (pricingRule.unit === "cbm" && volumeCbm) {
              calculatedCostUsd = (pricePerUnit * parseFloat(volumeCbm)).toFixed(2);
            }
          }
        }

        // Generate package code and insert; retry on duplicate key (concurrent quick-register)
        const maxAttempts = 4;
        let pkg: Awaited<ReturnType<typeof db.createPackage>> | undefined;
        let packageCode = "";
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          packageCode = input.isUnclaimed 
            ? await db.getNextUnclaimedPackageCode()
            : await db.getNextPackageCode(codePrefix);

          const qrData = JSON.stringify({
            customerCode: customer?.customerCode || "UNCLAIMED",
            packageCode,
            trackingNumber: input.trackingNumber,
            timestamp: Date.now(),
          });
          const qrSignature = signQrData(qrData);

          try {
            pkg = await db.createPackage({
              packageCode,
              trackingNumber: input.trackingNumber,
              customerId: input.isUnclaimed ? undefined : effectiveCustomerId,
              originWarehouseId: input.originWarehouseId,
              qrCodeData: qrData,
              qrCodeSignature: qrSignature,
              weightKg: input.weightKg,
              lengthCm: input.lengthCm,
              widthCm: input.widthCm,
              heightCm: input.heightCm,
              volumeCbm,
              shippingType: input.shippingType,
              description: input.description,
              photos: input.photos,
              calculatedCostUsd: input.isUnclaimed ? undefined : calculatedCostUsd,
              appliedPricingRuleId: input.isUnclaimed ? undefined : appliedPricingRuleId,
              registeredById: ctx.user.id,
              batchId: input.batchId,
              categoryId: input.categoryId,
              isUnclaimed: input.isUnclaimed || false,
              // Mirror the first linked order into the legacy FK for back-compat.
              fullPackageOrderId: linkedOrderIds[0] ?? input.fullPackageOrderId,
            });
            break;
          } catch (err: unknown) {
            // MySQL drivers expose three useful fields on InsertError:
            //   - code        e.g. "ER_DUP_ENTRY", "ER_NO_DEFAULT_FOR_FIELD"
            //   - errno       e.g. 1062 (duplicate), 1364 (no default),
            //                       1452 (FK violation), 1048 (NULL on NOT NULL)
            //   - sqlMessage  human-readable reason WITHOUT the SQL text
            //                 (much more useful than `message`, which prepends
            //                 the full INSERT and gets unhelpfully truncated)
            //
            // Drizzle wraps the underlying mysql2 error and may move these
            // onto `err.cause`, so we check both the direct error and its
            // cause chain before falling back to `message`.
            const errObj = (err && typeof err === "object") ? err as Record<string, unknown> : {};
            const cause = (errObj.cause && typeof errObj.cause === "object") ? errObj.cause as Record<string, unknown> : {};
            const msg = typeof errObj.message === "string" ? errObj.message : "";
            const sqlMessage =
              (typeof errObj.sqlMessage === "string" ? errObj.sqlMessage : "") ||
              (typeof cause.sqlMessage === "string" ? cause.sqlMessage : "");
            const code =
              (typeof errObj.code === "string" ? errObj.code : "") ||
              (typeof cause.code === "string" ? cause.code : "");
            const errno =
              (typeof errObj.errno === "number" ? errObj.errno : 0) ||
              (typeof cause.errno === "number" ? cause.errno : 0);
            const reason = sqlMessage || msg;
            const isDuplicate = code === "ER_DUP_ENTRY" || errno === 1062 || /duplicate|unique/i.test(reason);
            const isDuplicateTracking = isDuplicate && /tracking|trackingNumber/i.test(reason);

            // Always log the full error server-side so we keep diagnostic
            // history even when the user-facing message has to stay short.
            appLogger.error("[register] createPackage failed", {
              attempt, packageCode, code, errno, sqlMessage, msg: msg.slice(0, 400),
              input: {
                customerId: input.customerId, isUnclaimed: input.isUnclaimed,
                originWarehouseId: input.originWarehouseId, batchId: input.batchId,
                shippingType: input.shippingType, trackingNumber: input.trackingNumber,
              },
            });

            if (isDuplicateTracking) {
              throw new TRPCError({ code: "CONFLICT", message: "ئەم تراکینگە پێشتر تۆمار کراوە. ناتوانرێت دووبارە تۆماری بکەیت." });
            }
            if (!isDuplicate || attempt === maxAttempts - 1) {
              // Translate common MySQL errors to Kurdish before falling
              // back to the raw sqlMessage. Anything thrown by upstream
              // validation (کۆگا/کڕیار/گرووپ/جۆری) is already a TRPCError
              // and is re-thrown untouched.
              if (msg.includes("کۆگا") || msg.includes("کڕیار") || msg.includes("گرووپ") || msg.includes("جۆری")) {
                throw err;
              }
              let friendly = reason || "هەڵەی نەناسراو لە تۆمارکردن";
              if (errno === 1364 || /doesn't have a default value/i.test(reason)) {
                const field = reason.match(/Field '([^']+)'/)?.[1] ?? "نەناسراو";
                friendly = `بەهای ستوونی پێویست داخل نەکراوە: ${field}`;
              } else if (errno === 1048 || /cannot be null/i.test(reason)) {
                const field = reason.match(/Column '([^']+)'/)?.[1] ?? "نەناسراو";
                friendly = `ستوونی پێویست بەهای نییە: ${field} (NULL ـی پێ نادرێت)`;
              } else if (errno === 1452 || /foreign key constraint fails/i.test(reason)) {
                friendly = `بەهای پەیوەندیدار نەدۆزرایەوە (کۆگا، باچ، کڕیار، یاخود ئۆردەر) — تکایە دڵنیابە کە هەموو بەهاکان دروستن`;
              } else if (errno === 1062 || code === "ER_DUP_ENTRY") {
                friendly = `بەها دووبارەیە لە DB: ${reason.slice(0, 200)}`;
              }
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `هەڵەی داتابەیس: ${friendly.slice(0, 300)}`,
              });
            }
          }
        }

        if (!pkg) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create package" });
        }

        // Persist every package↔order link in the new join table. Index 0 is
        // the primary (mirrored into packages.fullPackageOrderId above) so any
        // legacy code path that reads only the FK still sees the same order
        // it would have seen pre-Phase-4. The join table is the source of
        // truth for "every order linked to this package" going forward.
        if (linkedOrderIds.length > 0) {
          try {
            await db.createPackageOrderLinks(
              pkg.id,
              linkedOrderIds.map((orderId, idx) => ({
                fullPackageOrderId: orderId,
                cartonIndex: 1, // shared-tracking case: all share carton 1 by convention
                isPrimary: idx === 0,
              })),
            );
          } catch (err) {
            appLogger.error("[Register] Failed to write packageOrderLinks", {
              packageId: pkg.id, linkedOrderIds,
              error: err instanceof Error ? err.message : String(err),
            });
            // Don't fail the package registration over a link write — the
            // primary FK still points to the right order via createPackage.
          }

          // Phase 6 — auto status promotion. After registering this carton,
          // check every linked order: if it has now received ALL its expected
          // cartons, advance to `in_china_warehouse` automatically. Failures
          // are non-fatal — the package row itself is already saved.
          for (const orderId of linkedOrderIds) {
            try {
              await db.promoteOrderStatusIfFullyReceived(orderId);
            } catch (err) {
              appLogger.warn("[Register] Status promotion check failed", {
                orderId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }

        // Cost is already saved to package (calculatedCostUsd). Charge happens at batch delivery only.

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "register_package",
          entityType: "package",
          entityId: pkg.id,
          newValues: {
            packageCode,
            customerId: input.customerId ?? effectiveCustomerId,
            linkedOrderIds,
          },
        });

        return pkg;
      }),
    // Get unclaimed packages
    getUnclaimed: staffProcedure
      .query(async () => {
        return db.getUnclaimedPackages();
      }),
    // Get unclaimed package count
    getUnclaimedCount: staffProcedure
      .query(async () => {
        return db.getUnclaimedPackageCount();
      }),
    // ============ CLAIM REQUESTS MANAGEMENT ============
    
    // Get all claim requests (admin)
    getClaimRequests: adminProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllClaimRequests(input);
      }),
    
    // Get pending claim requests count (for badge)
    getPendingClaimRequestsCount: staffProcedure
      .query(async () => {
        return db.getPendingClaimRequestsCount();
      }),
    
    // Approve a claim request
    approveClaimRequest: adminProcedure
      .input(z.object({
        requestId: z.number(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const request = await db.getClaimRequestById(input.requestId);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Claim request not found" });
        }
        if (request.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Request has already been processed" });
        }
        
        const result = await db.approveClaimRequest(input.requestId, ctx.user.id, input.adminNote);
        
        // Calculate and apply pricing if package is in a batch
        const pkg = await db.getPackageById(request.packageId);
        if (pkg && pkg.batchId) {
          const batch = await db.getBatchById(pkg.batchId);
          if (batch) {
            let calculatedCost = 0;
            if (batch.pricePerKg && pkg.weightKg) {
              // Use chargeable weight (max of actual and volumetric)
              const actualKg = parseFloat(pkg.weightKg?.toString() || "0");
              const lengthCm = parseFloat(pkg.lengthCm?.toString() || "0");
              const widthCm = parseFloat(pkg.widthCm?.toString() || "0");
              const heightCm = parseFloat(pkg.heightCm?.toString() || "0");
              const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
              const chargeableKg = Math.max(actualKg, volumetricKg);
              calculatedCost = parseFloat(batch.pricePerKg) * chargeableKg;
            } else if (batch.pricePerCbm && pkg.volumeCbm) {
              calculatedCost = parseFloat(batch.pricePerCbm) * parseFloat(pkg.volumeCbm);
            }
            
            if (calculatedCost > 0) {
              await db.updatePackage(request.packageId, {
                calculatedCostUsd: calculatedCost.toFixed(2),
              });
              // Charge happens when batch is delivered — NOT here
            }
          }
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "approve_claim_request",
          entityType: "claim_request",
          entityId: input.requestId,
          newValues: { status: "approved", customerId: request.customerId },
        });
        
        return result;
      }),
    
    // Reject a claim request
    rejectClaimRequest: adminProcedure
      .input(z.object({
        requestId: z.number(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const request = await db.getClaimRequestById(input.requestId);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Claim request not found" });
        }
        if (request.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Request has already been processed" });
        }
        
        const result = await db.rejectClaimRequest(input.requestId, ctx.user.id, input.adminNote);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "reject_claim_request",
          entityType: "claim_request",
          entityId: input.requestId,
          newValues: { status: "rejected" },
        });
        
        return result;
      }),
    
    // Claim a package (assign customer)
    claimPackage: staffProcedure
      .input(z.object({
        packageId: z.number(),
        customerId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        }
        if (!pkg.isUnclaimed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Package is already claimed" });
        }
        
        const customer = await db.getCustomerById(input.customerId);
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        }
        
        const updated = await db.claimPackage(input.packageId, input.customerId, ctx.user.id);

        // Pricing + late-charge for already-delivered batches.
        //
        // The standard flow is: package gets a batch → batch is delivered →
        // Phase 2C in batches.router.ts runs `recordPackageChargeWithoutInvoice`
        // for every uncharged package + creates one consolidated invoice.
        // That flow only sees packages whose customer is known at delivery
        // time. An unclaimed package whose owner appears LATER (after the
        // batch already left "delivered") falls through every gate — its
        // calculatedCostUsd was set, but no ledger debit and no invoice
        // ever happened. This block plugs that hole: when claim happens
        // post-delivery, recreate the same charge here so the customer's
        // balance and the invoice list reflect reality.
        let lateCharge: { invoiceNumber: string; amountUsd: number } | null = null;
        if (updated && updated.batchId) {
          const batch = await db.getBatchById(updated.batchId);
          if (batch) {
            // Compute chargeable cost from current measurements × batch rate.
            // Mirrors batches.router.ts Phase 2C exactly so a late-claim
            // and a normal-flow charge produce the same number.
            const isSea = batch.shippingType === 'sea';
            const pricePerKg = parseFloat(batch.pricePerKg?.toString() || '0') || 0;
            const pricePerCbm = parseFloat(batch.pricePerCbm?.toString() || '0') || 0;
            const actualKg = parseFloat(updated.weightKg?.toString() || '0') || 0;
            const lengthCm = parseFloat(updated.lengthCm?.toString() || '0') || 0;
            const widthCm = parseFloat(updated.widthCm?.toString() || '0') || 0;
            const heightCm = parseFloat(updated.heightCm?.toString() || '0') || 0;
            const cbm = parseFloat(updated.volumeCbm?.toString() || '0') || 0;
            const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
            const chargeableKg = Math.max(actualKg, volumetricKg);

            let calculatedCost = 0;
            if (isSea && pricePerCbm > 0 && cbm > 0) {
              calculatedCost = pricePerCbm * cbm;
            } else if (pricePerKg > 0 && chargeableKg > 0) {
              calculatedCost = pricePerKg * chargeableKg;
            }

            if (calculatedCost > 0) {
              await db.updatePackage(input.packageId, {
                calculatedCostUsd: calculatedCost.toFixed(2),
              });
            }

            // Skip the late-charge if the package belongs to a Full Package
            // order — FP shipping is a company cost, not the customer's.
            // Defensive check; unclaimed packages don't normally link to FP,
            // but being explicit prevents accidental double-charging if
            // someone wires a tracking number both ways.
            let isLinkedToFP = false;
            if (updated.trackingNumber) {
              const linkedFp = await db.getFullPackageOrderByTrackingNumber(updated.trackingNumber);
              if (linkedFp) isLinkedToFP = true;
            }

            const isBatchDelivered = batch.status === 'delivered';
            const alreadyCharged = updated.isCharged === true;
            const shouldLateCharge =
              isBatchDelivered &&
              !alreadyCharged &&
              !isLinkedToFP &&
              calculatedCost > 0;

            if (shouldLateCharge) {
              try {
                // Build the same rich line-item shape that Phase 2C uses,
                // so the invoice that lands in the customer's history is
                // visually identical to one they would have received had
                // they claimed before delivery.
                const descParts: string[] = [];
                const trackingLabel = updated.trackingNumber
                  ? `📦 ${updated.trackingNumber}`
                  : `📦 ${updated.packageCode}`;
                descParts.push(trackingLabel);
                if (updated.trackingNumber && updated.packageCode) {
                  descParts.push(`کۆد: ${updated.packageCode}`);
                }
                if ((updated as any).productDescription) {
                  descParts.push(`ناوەرۆک: ${(updated as any).productDescription}`);
                }
                if (isSea) {
                  const measureParts = [`CBM: ${cbm.toFixed(3)} m³`];
                  if (actualKg > 0) measureParts.push(`کێش: ${actualKg.toFixed(2)} kg`);
                  if (lengthCm > 0) measureParts.push(`${lengthCm}×${widthCm}×${heightCm} cm`);
                  descParts.push(measureParts.join(' · '));
                  descParts.push(`نرخ: ${cbm.toFixed(3)} m³ × $${pricePerCbm.toFixed(2)}/m³ = $${calculatedCost.toFixed(2)}`);
                } else {
                  const measureParts: string[] = [];
                  if (actualKg > 0) measureParts.push(`کێشی ڕاستەقینە: ${actualKg.toFixed(2)} kg`);
                  if (volumetricKg > 0) measureParts.push(`کێشی قەبارەیی: ${volumetricKg.toFixed(2)} kg`);
                  if (lengthCm > 0) measureParts.push(`${lengthCm}×${widthCm}×${heightCm} cm`);
                  if (measureParts.length) descParts.push(measureParts.join(' · '));
                  descParts.push(
                    `نرخ: ${chargeableKg.toFixed(2)} kg (${chargeableKg === volumetricKg && volumetricKg > actualKg ? 'قەبارەیی' : 'ڕاستەقینە'}) × $${pricePerKg.toFixed(2)}/kg = $${calculatedCost.toFixed(2)}`
                  );
                }
                descParts.push(`(چارجی دواکەوتوو — پاکەت پاش گەیشتنی باچ خاوەنی پەیداکراوە)`);

                const description = `پاکەت ${updated.trackingNumber || updated.packageCode} - باچ ${batch.batchCode || ''} (چارجی دواکەوتوو)`;
                const result = await db.applyCharge(
                  input.customerId,
                  customer.customerCode,
                  'PACKAGE',
                  input.packageId,
                  calculatedCost,
                  description,
                  ctx.user.id,
                  [{
                    description: descParts.join('\n'),
                    quantity: 1,
                    unitPrice: calculatedCost,
                    total: calculatedCost,
                  }],
                );

                // packages table only has `isCharged`; the transaction
                // <-> invoice link lives on ledger_transactions.invoiceId
                // (set by applyCharge), so cross-reference is preserved
                // even without per-package transaction id columns.
                await db.updatePackage(input.packageId, {
                  isCharged: true,
                });

                lateCharge = {
                  invoiceNumber: result.invoice.invoiceNumber,
                  amountUsd: calculatedCost,
                };

                appLogger.info('[claimPackage] Late charge applied', {
                  packageId: input.packageId,
                  packageCode: updated.packageCode,
                  customerId: input.customerId,
                  batchCode: batch.batchCode,
                  amountUsd: calculatedCost,
                  invoiceNumber: result.invoice.invoiceNumber,
                });
              } catch (e) {
                // Don't fail the whole claim if charging fails — the
                // package is already assigned to the customer at this
                // point. Surface the error in logs so accounting can
                // reconcile manually.
                appLogger.error('[claimPackage] Late charge FAILED — claim succeeded but no invoice created', {
                  packageId: input.packageId,
                  customerId: input.customerId,
                  error: e instanceof Error ? e.message : String(e),
                });
              }
            }
          }
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "claim_package",
          entityType: "package",
          entityId: input.packageId,
          newValues: {
            customerId: input.customerId,
            ...(lateCharge ? { lateCharge } : {}),
          },
        });

        return { ...updated, lateCharge };
      }),
    /**
     * What the warehouse took in over a period, grouped by customer.
     *
     * Read-only. Defaults to today, which is what the dashboard asks for; the
     * range is open so the same figures can be pulled for any day without a
     * second endpoint.
     */
    registrationSummary: staffProcedure
      .input(z.object({
        from: z.string().optional(),
        to: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const parse = (value: string | undefined, fallback: Date) => {
          if (!value) return fallback;
          const d = new Date(value);
          return isNaN(d.getTime()) ? fallback : d;
        };

        return db.getRegistrationSummary({
          from: parse(input?.from, startOfToday),
          to: parse(input?.to, endOfToday),
        });
      }),

    assignToBatch: staffProcedure
      .input(z.object({
        packageId: z.number(),
        batchId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updatePackage(input.packageId, {
          batchId: input.batchId,
          status: "in_batch",
        });
        
        // Update batch package count
        const batch = await db.getBatchById(input.batchId);
        if (batch) {
          await db.updateBatch(input.batchId, {
            totalPackages: batch.totalPackages + 1,
          });
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "assign_package_to_batch",
          entityType: "package",
          entityId: input.packageId,
          newValues: { batchId: input.batchId },
        });
        return { success: true };
      }),
    updateStatus: staffProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum([
          "registered", "in_batch", "in_transit", "customs_processing",
          "ready_for_delivery", "out_for_delivery", "delivered", "returned", "cancelled"
        ]),
        recipientName: z.string().optional(),
        recipientSignature: z.string().optional(),
        deliveryPhoto: z.string().optional(),
        deliveryType: z.enum(["air_transit", "warehouse_pickup", "direct_delivery"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        
        // Get package details before update
        const pkg = await db.getPackageById(id);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        }
        
        const updateData: Partial<InsertPackage> = { ...data };
        if (input.status === "delivered") {
          updateData.deliveredAt = new Date();
          updateData.deliveredById = ctx.user.id;
          
          // Check if this package is linked to a Full Package order
          // If linked, DO NOT charge customer - shipping is our cost, not customer's
          let isLinkedToFullPackage = false;
          let linkedFullPackageOrder = null;
          if (pkg.trackingNumber) {
            linkedFullPackageOrder = await db.getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
            if (linkedFullPackageOrder) {
              isLinkedToFullPackage = true;
              appLogger.info("[FullPackage] Package linked to Full Package - shipping cost will NOT be charged to customer", { packageCode: pkg.packageCode, orderCode: linkedFullPackageOrder.orderCode });
            }
          }
          
          // Automatic pricing on delivery - only if not already charged and has customer
          // SKIP charging if package is linked to Full Package (shipping is our cost)
          if (!pkg.isCharged && pkg.customerId && !pkg.isUnclaimed && !isLinkedToFullPackage) {
            let chargeAmount = 0;
            let pricePerUnit = 0;
            let unit: 'kg' | 'cbm' = 'kg';
            let pricingSource = '';
            
            // First, try batch-based pricing if package is in a batch
            if (pkg.batchId) {
              const batch = await db.getBatchById(pkg.batchId);
              if (batch) {
                unit = batch.shippingType === 'sea' ? 'cbm' : 'kg';
                const customerTotal = await db.getCustomerTotalInBatch(pkg.batchId, pkg.customerId, unit);
                
                // Check if batch uses tiered pricing
                if (batch.useTieredPricing) {
                  const tierPrice = await db.getApplicableTierPrice(pkg.batchId, customerTotal);
                  if (tierPrice !== null) {
                    pricePerUnit = tierPrice;
                    pricingSource = 'batch_tiered';
                  }
                }
                
                // If no tiered price, use batch default price
                if (pricePerUnit === 0) {
                  pricePerUnit = unit === 'cbm' 
                    ? Number(batch.pricePerCbm) || 0 
                    : Number(batch.pricePerKg) || 0;
                  pricingSource = 'batch_default';
                }
                
                // Calculate charge based on unit
                if (pricePerUnit > 0) {
                  if (unit === 'cbm' && pkg.volumeCbm) {
                    chargeAmount = pricePerUnit * parseFloat(pkg.volumeCbm);
                  } else if (unit === 'kg') {
                    // Use chargeable weight (max of actual weight and volumetric weight)
                    const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                    const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                    const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                    const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                    const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                    const chargeableKg = Math.max(actualKg, volumetricKg);
                    chargeAmount = pricePerUnit * chargeableKg;
                  }
                }
              }
            }
            
            // Fallback to global pricing rules if no batch pricing
            if (chargeAmount === 0 && pkg.weightKg) {
              const warehouse = await db.getWarehouseById(pkg.originWarehouseId);
              const destCountries = await db.getDestinationCountries();
              const destCountry = destCountries[0];
              
              if (warehouse && destCountry) {
                const pricingRule = await db.getApplicablePricingRule(
                  warehouse.countryId,
                  destCountry.id,
                  pkg.shippingType
                );
                
                if (pricingRule) {
                  pricePerUnit = parseFloat(pricingRule.pricePerUnit);
                  unit = pricingRule.unit;
                  pricingSource = 'global_rule';
                  
                  if (pricingRule.unit === "kg") {
                    // Use chargeable weight (max of actual weight and volumetric weight)
                    const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                    const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                    const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                    const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                    const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                    const chargeableKg = Math.max(actualKg, volumetricKg);
                    chargeAmount = pricePerUnit * chargeableKg;
                  } else if (pricingRule.unit === "cbm" && pkg.volumeCbm) {
                    chargeAmount = pricePerUnit * parseFloat(pkg.volumeCbm);
                  }
                }
              }
            }
            
            if (chargeAmount > 0) {
              updateData.calculatedCostUsd = chargeAmount.toFixed(2);
              // Do NOT charge here — charge happens at batch delivery only.
              // Do NOT set isCharged, create revenue record, or update daily summary here.
            }
          }
        }
        
        await db.updatePackage(id, updateData);
        
        // Sync status to fullPackageOrder if this package is linked to one
        // Also calculate shipping cost for Full Package even though we don't charge customer
        if (pkg.trackingNumber) {
          try {
            const fullPackageOrder = await db.getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
            if (fullPackageOrder) {
              // Map package status to fullPackageOrder status
              const statusMap: Record<string, string> = {
                'registered': 'ordered',
                'in_batch': 'in_transit',
                'in_transit': 'in_transit',
                'customs_processing': 'in_transit',
                'ready_for_delivery': 'arrived',
                'out_for_delivery': 'arrived',
                'delivered': 'delivered',
                'returned': 'ordered',
                'cancelled': 'cancelled'
              };
              
              const newStatus = statusMap[input.status];
              if (newStatus && newStatus !== fullPackageOrder.status) {
                const fpUpdateData: Partial<InsertFullPackageOrder> = { status: newStatus as InsertFullPackageOrder["status"] };
                
                // If delivered, calculate shipping cost for Full Package profit calculation
                // This is OUR cost, not charged to customer
                if (input.status === 'delivered') {
                  // Calculate shipping cost based on batch pricing or global rules
                  let shippingCost = 0;
                  
                  // If package already has calculated cost, use it
                  if (pkg.calculatedCostUsd) {
                    shippingCost = parseFloat(pkg.calculatedCostUsd);
                  } else {
                    // Calculate shipping cost based on pricing rules
                    let pricePerUnit = 0;
                    let unit: 'kg' | 'cbm' = 'kg';
                    
                    // Try batch-based pricing first
                    if (pkg.batchId) {
                      const batch = await db.getBatchById(pkg.batchId);
                      if (batch) {
                        unit = batch.shippingType === 'sea' ? 'cbm' : 'kg';
                        const customerTotal = pkg.customerId ? await db.getCustomerTotalInBatch(pkg.batchId, pkg.customerId, unit) : 0;
                        
                        if (batch.useTieredPricing) {
                          const tierPrice = await db.getApplicableTierPrice(pkg.batchId, customerTotal);
                          if (tierPrice !== null) pricePerUnit = tierPrice;
                        }
                        
                        if (pricePerUnit === 0) {
                          pricePerUnit = unit === 'cbm' 
                            ? Number(batch.pricePerCbm) || 0 
                            : Number(batch.pricePerKg) || 0;
                        }
                      }
                    }
                    
                    // Fallback to global pricing rules
                    if (pricePerUnit === 0 && pkg.weightKg) {
                      const warehouse = await db.getWarehouseById(pkg.originWarehouseId);
                      const destCountries = await db.getDestinationCountries();
                      const destCountry = destCountries[0];
                      
                      if (warehouse && destCountry) {
                        const pricingRule = await db.getApplicablePricingRule(
                          warehouse.countryId,
                          destCountry.id,
                          pkg.shippingType
                        );
                        
                        if (pricingRule) {
                          pricePerUnit = parseFloat(pricingRule.pricePerUnit);
                          unit = pricingRule.unit;
                        }
                      }
                    }
                    
                    // Calculate shipping cost
                    if (pricePerUnit > 0) {
                      if (unit === 'cbm' && pkg.volumeCbm) {
                        shippingCost = pricePerUnit * parseFloat(pkg.volumeCbm);
                      } else if (unit === 'kg') {
                        // Use chargeable weight (max of actual weight and volumetric weight)
                        const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                        const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                        const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                        const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                        const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                        const chargeableKg = Math.max(actualKg, volumetricKg);
                        shippingCost = pricePerUnit * chargeableKg;
                      }
                    }
                    
                    // Save calculated cost to package for reference
                    if (shippingCost > 0) {
                      await db.updatePackage(pkg.id, { calculatedCostUsd: shippingCost.toFixed(2) });
                    }
                  }
                  
                  if (shippingCost > 0) {
                    fpUpdateData.shippingCostUsd = shippingCost.toFixed(2);
                    appLogger.info("[FullPackage] Updating order with shipping cost (OUR cost, not charged to customer)", { orderId: fullPackageOrder.id, shippingCost });
                  }
                }
                
                await db.updateFullPackageOrder(fullPackageOrder.id, fpUpdateData, ctx.user.id);
                appLogger.info("[FullPackage] Synced status from package to order", { packageCode: pkg.packageCode, orderId: fullPackageOrder.id, newStatus });
              }
            }
          } catch (e) {
            appLogger.error('[FullPackage] Failed to sync status to fullPackageOrder', { error: e instanceof Error ? e.message : String(e) });
          }
        }
        
        // Send notification to customer about status change
        try {
          await notifyPackageStatusChange(id, input.status);
        } catch (e) {
          appLogger.error("[Notification] Failed to send package status notification", { error: e instanceof Error ? e.message : String(e) });
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_package_status",
          entityType: "package",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        customerId: z.number().optional(),
        weightKg: z.string().optional(),
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]).optional(),
        description: z.string().optional(),
        lengthCm: z.string().optional(),
        widthCm: z.string().optional(),
        heightCm: z.string().optional(),
        trackingNumber: z.string().optional(),
        batchId: z.number().nullable().optional(),
        categoryId: z.number().nullable().optional(),
        volumeCbm: z.string().optional(),
        photos: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, volumeCbm: inputVolumeCbm, photos, ...data } = input;
        
        // Calculate volume if dimensions provided, or use direct input
        const updateData: Partial<InsertPackage> = { ...data };
        if (inputVolumeCbm) {
          updateData.volumeCbm = inputVolumeCbm;
        } else if (data.lengthCm && data.widthCm && data.heightCm) {
          const volumeCbm = (parseFloat(data.lengthCm) * parseFloat(data.widthCm) * parseFloat(data.heightCm)) / 1000000;
          updateData.volumeCbm = volumeCbm.toFixed(6);
        }
        
        // Handle photos
        if (photos) {
          (updateData as Record<string, unknown>).photos = JSON.stringify(photos);
        }
        
        // Handle batch assignment status change
        if (data.batchId !== undefined) {
          if (data.batchId === null) {
            updateData.status = 'registered';
          } else {
            const pkg = await db.getPackageById(id);
            if (pkg && pkg.status === 'registered') {
              updateData.status = 'in_batch';
            }
          }
        }
        
        await db.updatePackage(id, updateData);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_package",
          entityType: "package",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const pkg = await db.getPackageById(input.id);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        }
        
        await db.deletePackage(input.id);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_package",
          entityType: "package",
          entityId: input.id,
          oldValues: pkg,
        });
        return { success: true };
      }),
    verifyQr: staffProcedure
      .input(z.object({
        qrData: z.string(),
        signature: z.string(),
      }))
      .query(async ({ input }) => {
        const isValid = verifyQrSignature(input.qrData, input.signature);
        if (!isValid) {
          return { valid: false, package: null };
        }
        
        try {
          const data = JSON.parse(input.qrData);
          const pkg = await db.getPackageByCode(data.packageCode);
          return { valid: true, package: pkg };
        } catch {
          return { valid: false, package: null };
        }
      }),
});

