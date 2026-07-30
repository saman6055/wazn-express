import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { appLogger } from "../utils/logger";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";

async function autoSplitShippingByTracking(order: any, userId: number): Promise<void> {
  const trackingNumber = order.trackingNumber;
  if (!trackingNumber || !order.batchId) return;

  const batch = await db.getBatchById(order.batchId);
  if (!batch?.shippingCost || parseFloat(batch.shippingCost as string) <= 0) return;

  const totalBatchShipping = parseFloat(batch.shippingCost as string);
  const shippingType = (batch.shippingType as string) || 'air_regular';
  const isSea = shippingType === 'sea';

  const batchOrders = await db.getOrdersByBatchId(order.batchId);
  const ordersWithTracking = batchOrders.filter((o: any) => o.trackingNumber);
  if (ordersWithTracking.length === 0) return;

  // Group by trackingNumber
  const trackingGroups = new Map<string, any[]>();
  for (const o of ordersWithTracking) {
    const tn = o.trackingNumber!;
    if (!trackingGroups.has(tn)) trackingGroups.set(tn, []);
    trackingGroups.get(tn)!.push(o);
  }

  // Skip if this tracking group already has shipping cost assigned
  const thisGroup = trackingGroups.get(trackingNumber) || [];
  if (thisGroup.some((o: any) => parseFloat(o.shippingCostUsd?.toString() || '0') > 0)) return;

  // Measure per group (Level 1 proportioning between tracking groups)
  const getMeasure = (o: any): number => {
    if (isSea) return parseFloat(o.volumeCbm?.toString() || '0') || 0;
    const kg = parseFloat(o.weightKg?.toString() || '0') || 0;
    const l = parseFloat(o.dimensionLength?.toString() || '0') || 0;
    const w = parseFloat(o.dimensionWidth?.toString() || '0') || 0;
    const h = parseFloat(o.dimensionHeight?.toString() || '0') || 0;
    return Math.max(kg, (l * w * h) / 6000);
  };

  const groupWeights = new Map<string, number>();
  let totalWeight = 0;
  for (const [tn, orders] of trackingGroups) {
    const gw = orders.reduce((s: number, o: any) => s + getMeasure(o), 0);
    groupWeights.set(tn, gw);
    totalWeight += gw;
  }

  const useEqual = totalWeight === 0;
  const groupCount = trackingGroups.size;
  const thisWeight = groupWeights.get(trackingNumber) || 0;
  const ratio = useEqual ? (1 / groupCount) : (thisWeight / totalWeight);
  const groupShipping = Math.round(totalBatchShipping * ratio * 100) / 100;

  // Level 2: equal split within the same tracking group
  const perOrder = Math.round((groupShipping / thisGroup.length) * 100) / 100;
  for (let i = 0; i < thisGroup.length; i++) {
    let share = perOrder;
    if (i === thisGroup.length - 1) {
      // Last order absorbs rounding difference
      share = Math.round((groupShipping - perOrder * (thisGroup.length - 1)) * 100) / 100;
    }
    await db.updateFullPackageOrder(thisGroup[i].id, {
      shippingCostUsd: share.toFixed(2),
      shippingType: shippingType as any,
    }, userId);
  }

  appLogger.info('[ShippingSplit] Auto-split on delivery', {
    orderId: order.id,
    trackingNumber,
    batchId: order.batchId,
    groupShipping,
    perOrder,
    count: thisGroup.length,
  });
}

export const fullPackageRouter = router({
    list: staffProcedure
      .input(z.object({
        customerId: z.number().optional(),
        supplierId: z.number().optional(),
        status: z.string().optional(),
        orderType: z.enum(["full_package", "purchase_request", "commission", "resale", "purchase"]).optional(),
        hasBatch: z.boolean().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        qualityCheckStatus: z.enum(["pending", "passed", "failed", "partial"]).optional(),
        isReturned: z.boolean().optional(),
        search: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllFullPackageOrders(input);
      }),
    
    /**
     * Get all pending (uncharged, not-yet-delivered) orders for a customer.
     * Used by the Customer Finance tab's "Pending Orders" section to show
     * everything still flowing through the pipeline before an invoice exists.
     *
     * An order is "pending" when:
     *   - isCharged = false (no ledger DEBIT yet)
     *   - status NOT IN ('delivered', 'cancelled', 'refunded', 'returned')
     *   - not soft-deleted (list() already filters deletedAt)
     *
     * Also returns an aggregate summary (count, total estimated value, oldest
     * order age) so the UI can render stat cards without re-computing.
     */
    getCustomerPendingOrders: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        const rawOrders = await db.getAllFullPackageOrders({ customerId: input.customerId });
        const list = Array.isArray(rawOrders) ? rawOrders : (rawOrders as any)?.data ?? [];
        const TERMINAL = new Set(['delivered', 'cancelled', 'refunded', 'returned']);
        const pending = list.filter((o: any) =>
          !o.isCharged && !o.isChargedToCustomer && !TERMINAL.has(o.status || '')
        );

        let totalPriceUsd = 0;
        let oldestAt: Date | null = null;
        const byType = { full_package: 0, commission: 0, purchase_request: 0 };

        for (const o of pending) {
          const amount = db.computeOrderChargeAmount({
            orderType: o.orderType,
            sellingPriceUsd: o.sellingPriceUsd,
            itemPriceUsd: o.itemPriceUsd,
            commissionFeeUsd: o.commissionFeeUsd,
            quantity: o.quantity,
          });
          totalPriceUsd += amount;

          const createdAt = o.createdAt ? new Date(o.createdAt) : null;
          if (createdAt && (!oldestAt || createdAt < oldestAt)) oldestAt = createdAt;

          if (o.orderType === 'commission') byType.commission++;
          else if (o.orderType === 'purchase_request') byType.purchase_request++;
          else byType.full_package++;
        }

        return {
          orders: pending,
          summary: {
            count: pending.length,
            totalPriceUsd: Math.round(totalPriceUsd * 100) / 100,
            oldestAt: oldestAt ? oldestAt.toISOString() : null,
            byType,
          },
        };
      }),

    // Get dashboard statistics (enhanced)
    getStats: staffProcedure.query(async () => {
      return db.getFullPackageStats();
    }),
    
    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getFullPackageOrderById(input.id);
      }),
    
    create: staffProcedure
      .input(z.object({
        customerId: z.number(),
        supplierId: z.number().optional(),
        orderType: z.enum(["full_package", "purchase_request", "commission"]).default("full_package"),
        productName: z.string().min(1),
        productLink: z.string().optional(),
        productImage: z.string().optional(),
        productImages: z.array(z.string()).optional(),
        productDescription: z.string().optional(),
        quantity: z.number().min(1).default(1),
        color: z.string().optional(),
        size: z.string().optional(),
        productType: z.string().optional(),
        // Supplier tracking
        supplierTrackingNumber: z.string().optional(),
        supplierOrderNumber: z.string().optional(),
        purchaseInvoiceUrl: z.string().optional(),
        // Resale pricing
        purchasePriceUsd: z.string().optional(),
        purchasePriceCny: z.string().optional(),
        sellingPriceUsd: z.string().optional(),
        // Purchase service pricing
        estimatedPriceUsd: z.string().optional(),
        purchaseFeeUsd: z.string().optional(),
        // Commission purchase fields
        itemPriceUsd: z.string().optional(), // For commission: actual item price
        itemPriceCny: z.string().optional(), // For commission: item price in CNY
        commissionFeeUsd: z.string().optional(), // For commission: service fee
        totalPrepaidUsd: z.string().optional(), // For commission: total prepaid (item + commission)
        // Legacy commission fields
        commissionRate: z.string().optional(),
        commissionAmount: z.string().optional(),
        // Advance payment at order creation (partial/full prepayment)
        advancePaidUsd: z.string().optional(),
        advancePaymentMethod: z.enum(['CASH','BANK_TRANSFER','FIB','FASTPAY','ZAINCASH','ASIAHAWALA','CARD','OTHER']).optional(),
        // Shipping
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]).optional(),
        shippingCostUsd: z.string().optional(),
        weightKg: z.string().optional(),
        volumeCbm: z.string().optional(),
        dimensionLength: z.string().optional(),
        dimensionWidth: z.string().optional(),
        dimensionHeight: z.string().optional(),
        // Order info
        platform: z.string().max(100).optional(),
        orderNumber: z.string().optional(),
        trackingNumber: z.string().optional(),
        trackingNumbers: z.array(z.string()).optional(), // Multiple tracking numbers
        orderDate: z.date().optional(),
        expectedDeliveryDate: z.date().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        customerNotes: z.string().optional(),
        internalNotes: z.string().optional(),
        packageOwnership: z.enum(["customer", "company"]).optional(),
        batchId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Every real order has an order number from the shop it was bought on,
        // so it is required — an order without one can't be traced back.
        if (!input.orderNumber || !input.orderNumber.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ئۆردەر نەمبەر پێویستە | An order number is required",
          });
        }
        // Order numbers must be unique — each real order has exactly one. Reject
        // a create that reuses an existing (non-deleted) order's number so a
        // duplicate can't be entered by mistake.
        if (input.orderNumber && input.orderNumber.trim()) {
          const dup = await db.getFullPackageOrderByOrderNumber(input.orderNumber);
          if (dup) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `ئەم ئۆردەر نەمبەرە پێشتر بەکارهاتووە لە ئۆردەری ${dup.orderCode}. هەر ئۆردەرێک دەبێت ئۆردەر نەمبەرێکی ناوازەی هەبێت. | This order number is already used by ${dup.orderCode}. Each order must have a unique order number.`,
            });
          }
        }

        // Generate unique order code based on order type
        const prefix = input.orderType === 'commission' ? 'CM' :
                       input.orderType === 'purchase_request' ? 'PR' : 'FP';
        const orderCode = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
        
        // Determine initial status based on order type
        let initialStatus: 'pending_quote' | 'ordered' | 'pending';
        if (input.orderType === 'purchase_request') {
          initialStatus = 'pending_quote'; // Customer request needs quote first
        } else if (input.orderNumber) {
          initialStatus = 'ordered';
        } else {
          initialStatus = 'pending';
        }
        
        // Calculate gross profit for full_package orders (per unit - display multiplies by quantity)
        let grossProfitUsd: string | undefined;
        if (input.orderType === 'full_package' && 
            input.sellingPriceUsd && input.purchasePriceUsd) {
          const selling = parseFloat(input.sellingPriceUsd);
          const purchase = parseFloat(input.purchasePriceUsd);
          // Store per-unit profit - frontend will multiply by quantity for display
          grossProfitUsd = (selling - purchase).toFixed(2);
        }
        
        // For commission orders, calculate total prepaid if not provided
        let totalPrepaid = input.totalPrepaidUsd;
        let itemPrice = 0;
        let commissionFee = 0;
        if (input.orderType === 'commission') {
          itemPrice = parseFloat(input.itemPriceUsd || '0');
          commissionFee = parseFloat(input.commissionFeeUsd || '0');
          const qty = input.quantity || 1;
          if (!totalPrepaid && input.itemPriceUsd) {
            // Both figures are PER-UNIT — see db.commissionGoodsTotal.
            totalPrepaid = db.commissionGoodsTotal(itemPrice, commissionFee, qty).toFixed(2);
          }
          // Commission is our profit — per unit, so it scales with quantity.
          grossProfitUsd = db.commissionProfit(commissionFee, qty).toFixed(2);
        }
        
        const order = await db.createFullPackageOrder({
          ...input,
          orderCode,
          status: initialStatus,
          grossProfitUsd,
          totalPrepaidUsd: totalPrepaid,
          orderDate: input.orderDate || (input.orderNumber ? new Date() : undefined),
          createdById: ctx.user.id,
          // NOTE: Commission orders are NO LONGER charged at creation.
          // Both commission and full_package are charged at batch delivery
          // (see batches.router.ts). This allows safe edit/delete of pending
          // orders without polluting the customer's ledger.
        });

        // Advance payment — record as CREDIT_PAYMENT on customer account if provided
        const advance = parseFloat(input.advancePaidUsd || '0');
        if (advance > 0) {
          const customer = await db.getCustomerById(input.customerId);
          if (customer) {
            try {
              const paymentResult = await db.recordPaymentReceived(
                input.customerId,
                customer.customerCode,
                advance,
                0,
                input.advancePaymentMethod || 'CASH',
                ctx.user.id,
                `پارەی پێشەکی بۆ ئۆردەری ${orderCode} - ${input.productName}`,
                undefined,
                undefined,
                undefined,
              );
              await db.updateFullPackageOrder(order.id, {
                advancePaidUsd: advance.toFixed(2),
                advancePaidAt: new Date(),
                advancePaymentMethod: input.advancePaymentMethod || 'CASH',
                advancePaymentTransactionId: paymentResult.transaction.id,
              });
              appLogger.info("[Advance Payment] Recorded advance payment", { customerCode: customer.customerCode, orderCode, advance });
            } catch (err) {
              appLogger.error("[Advance Payment] Failed to record advance payment", { error: err instanceof Error ? err.message : String(err), orderCode, advance });
            }
          }
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: input.orderType === 'commission' ? "create_commission_order" : "create_full_package_order",
          entityType: "full_package_order",
          entityId: order.id,
          newValues: input,
        });

        return order;
      }),

    bulkCreate: staffProcedure
      .input(z.object({
        customerId: z.number(),
        orderType: z.enum(["full_package", "purchase_request", "commission"]).default("full_package"),
        items: z.array(z.object({
          supplierId: z.number().optional(),
          productName: z.string().min(1),
          productLink: z.string().optional(),
          productImage: z.string().optional(),
          productImages: z.array(z.string()).optional(),
          productDescription: z.string().optional(),
          quantity: z.number().min(1).default(1),
          color: z.string().optional(),
          size: z.string().optional(),
          productType: z.string().optional(),
          supplierTrackingNumber: z.string().optional(),
          supplierOrderNumber: z.string().optional(),
          purchaseInvoiceUrl: z.string().optional(),
          purchasePriceUsd: z.string().optional(),
          purchasePriceCny: z.string().optional(),
          sellingPriceUsd: z.string().optional(),
          estimatedPriceUsd: z.string().optional(),
          purchaseFeeUsd: z.string().optional(),
          itemPriceUsd: z.string().optional(),
          itemPriceCny: z.string().optional(),
          commissionFeeUsd: z.string().optional(),
          totalPrepaidUsd: z.string().optional(),
          commissionRate: z.string().optional(),
          commissionAmount: z.string().optional(),
          advancePaidUsd: z.string().optional(),
          advancePaymentMethod: z.enum(['CASH','BANK_TRANSFER','FIB','FASTPAY','ZAINCASH','ASIAHAWALA','CARD','OTHER']).optional(),
          shippingType: z.enum(["air_regular", "air_irregular", "sea"]).optional(),
          shippingCostUsd: z.string().optional(),
          weightKg: z.string().optional(),
          volumeCbm: z.string().optional(),
          dimensionLength: z.string().optional(),
          dimensionWidth: z.string().optional(),
          dimensionHeight: z.string().optional(),
          platform: z.string().max(100).optional(),
          orderNumber: z.string().optional(),
          trackingNumber: z.string().optional(),
          orderDate: z.date().optional(),
          expectedDeliveryDate: z.date().optional(),
          priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
          tags: z.array(z.string()).optional(),
          notes: z.string().optional(),
          customerNotes: z.string().optional(),
          internalNotes: z.string().optional(),
          packageOwnership: z.enum(["customer", "company"]).optional(),
          batchId: z.number().optional(),
        })).min(1).max(50),
      }))
      .mutation(async ({ input, ctx }) => {
        const results: Awaited<ReturnType<typeof db.createFullPackageOrder>>[] = [];
        const errors: { index: number; error: string }[] = [];
        
        for (let i = 0; i < input.items.length; i++) {
          const item = input.items[i];
          try {
            const prefix = input.orderType === 'commission' ? 'CM' : 
                           input.orderType === 'purchase_request' ? 'PR' : 'FP';
            const orderCode = `${prefix}-${Date.now().toString(36).toUpperCase()}${i}`;
            
            let initialStatus: 'pending_quote' | 'ordered' | 'pending';
            if (input.orderType === 'purchase_request') {
              initialStatus = 'pending_quote';
            } else if (item.orderNumber) {
              initialStatus = 'ordered';
            } else {
              initialStatus = 'pending';
            }
            
            let grossProfitUsd: string | undefined;
            if (input.orderType === 'full_package' && 
                item.sellingPriceUsd && item.purchasePriceUsd) {
              const selling = parseFloat(item.sellingPriceUsd);
              const purchase = parseFloat(item.purchasePriceUsd);
              grossProfitUsd = (selling - purchase).toFixed(2);
            }
            
            let totalPrepaid = item.totalPrepaidUsd;
            let itemPrice = 0;
            let commissionFee = 0;
            if (input.orderType === 'commission') {
              itemPrice = parseFloat(item.itemPriceUsd || '0');
              commissionFee = parseFloat(item.commissionFeeUsd || '0');
              // Quantity was missing here entirely, so a bulk-created order of
              // N units stored the price of ONE.
              const qty = item.quantity || 1;
              if (!totalPrepaid && item.itemPriceUsd) {
                totalPrepaid = db.commissionGoodsTotal(itemPrice, commissionFee, qty).toFixed(2);
              }
              grossProfitUsd = db.commissionProfit(commissionFee, qty).toFixed(2);
            }
            
            const order = await db.createFullPackageOrder({
              ...item,
              customerId: input.customerId,
              orderType: input.orderType,
              orderCode,
              status: initialStatus,
              grossProfitUsd,
              totalPrepaidUsd: totalPrepaid,
              orderDate: item.orderDate || (item.orderNumber ? new Date() : undefined),
              createdById: ctx.user.id,
              // NOTE: Commission orders are NO LONGER charged at creation.
              // Both commission and full_package are charged at batch delivery.
            });
            // itemPrice/commissionFee used above for grossProfitUsd calculation
            void itemPrice;
            void commissionFee;

            // Advance payment — record as CREDIT_PAYMENT on customer account if provided
            const advance = parseFloat(item.advancePaidUsd || '0');
            if (advance > 0) {
              const customer = await db.getCustomerById(input.customerId);
              if (customer) {
                try {
                  const paymentResult = await db.recordPaymentReceived(
                    input.customerId,
                    customer.customerCode,
                    advance,
                    0,
                    item.advancePaymentMethod || 'CASH',
                    ctx.user.id,
                    `پارەی پێشەکی بۆ ئۆردەری ${orderCode} - ${item.productName}`,
                    undefined,
                    undefined,
                    undefined,
                  );
                  await db.updateFullPackageOrder(order.id, {
                    advancePaidUsd: advance.toFixed(2),
                    advancePaidAt: new Date(),
                    advancePaymentMethod: item.advancePaymentMethod || 'CASH',
                    advancePaymentTransactionId: paymentResult.transaction.id,
                  });
                  appLogger.info("[Advance Payment] Recorded advance payment (bulk)", { customerCode: customer.customerCode, orderCode, advance });
                } catch (err) {
                  appLogger.error("[Advance Payment] Failed to record advance payment (bulk)", { error: err instanceof Error ? err.message : String(err), orderCode, advance });
                }
              }
            }

            results.push(order);
          } catch (err: unknown) {
            errors.push({ index: i, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: `bulk_create_${input.orderType}_orders`,
          entityType: "full_package_order",
          entityId: results[0]?.id || 0,
          newValues: { count: results.length, orderType: input.orderType, errors: errors.length },
        });
        
        return { created: results, errors, total: input.items.length };
      }),
    
    /**
     * Plan v3, Phase 3 — safe update mutation.
     *
     * Guarantees:
     *   1. Concurrency-safe via OCC: client passes `expectedVersion` from the
     *      record they saw; if a different user saved in between, we return
     *      CONFLICT instead of clobbering their change.
     *   2. Ledger-safe: if a money-changing field (pricing, quantity) would
     *      alter what the customer owes, we call adjustCharge() which emits
     *      an ADJUSTMENT_DEBIT / ADJUSTMENT_CREDIT so the customer balance
     *      stays in exact sync with the order. Never mutates the original
     *      DEBIT row.
     *   3. Transparent: a human-readable `reason` is required when money
     *      changes, and it's written into the ledger description + the
     *      audit log — so there's always a trail for why a charge shifted.
     *   4. Advance-payment safe: the existing advance-payment delta logic
     *      is preserved (and also requires a reason when moving money).
     */
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        // Plan v3 — OCC: if provided, we reject the update when the order
        // was modified by another user since the client last loaded it.
        // Optional to stay backward-compatible with legacy callers; the
        // new edit form will always send it.
        expectedVersion: z.number().optional(),
        // Plan v3 — reason: required when any money-affecting field changes.
        // Embedded into the ledger adjustment description and the audit log.
        reason: z.string().optional(),

        // Customer reassignment — only allowed on a financially-clean,
        // unlinked order (see guard in handler). Optional so existing
        // callers that never touch the customer keep working unchanged.
        customerId: z.number().optional(),

        supplierId: z.number().nullable().optional(),
        productName: z.string().optional(),
        productLink: z.string().optional(),
        productImage: z.string().optional(),
        productImages: z.array(z.string()).optional(),
        productDescription: z.string().optional(),
        quantity: z.number().min(1).optional(),
        color: z.string().optional(),
        size: z.string().optional(),
        productType: z.string().optional(),
        // Supplier tracking
        supplierTrackingNumber: z.string().optional(),
        supplierOrderNumber: z.string().optional(),
        purchaseInvoiceUrl: z.string().optional(),
        // Pricing
        purchasePriceUsd: z.string().optional(),
        purchasePriceCny: z.string().optional(),
        sellingPriceUsd: z.string().optional(),
        estimatedPriceUsd: z.string().optional(),
        actualPriceUsd: z.string().optional(),
        purchaseFeeUsd: z.string().optional(),
        commissionRate: z.string().optional(),
        commissionAmount: z.string().optional(),
        // Commission-specific money fields
        itemPriceUsd: z.string().optional(),
        itemPriceCny: z.string().optional(),
        commissionFeeUsd: z.string().optional(),
        // Shipping
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]).optional(),
        shippingCostUsd: z.string().optional(),
        weightKg: z.string().optional(),
        volumeCbm: z.string().optional(),
        dimensionLength: z.string().optional(),
        dimensionWidth: z.string().optional(),
        dimensionHeight: z.string().optional(),
        // Order info
        platform: z.string().max(100).optional(),
        orderNumber: z.string().optional(),
        trackingNumber: z.string().optional(),
        trackingNumbers: z.array(z.string()).optional(), // Multiple tracking numbers
        expectedDeliveryDate: z.date().nullable().optional(),
        // Quality check
        qualityCheckStatus: z.enum(["pending", "passed", "failed", "partial"]).optional(),
        qualityCheckNotes: z.string().optional(),
        // Tags & Notes
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        customerNotes: z.string().optional(),
        internalNotes: z.string().optional(),
        // Advance payment (can be edited)
        advancePaidUsd: z.string().optional(),
        advancePaymentMethod: z.enum(['CASH','BANK_TRANSFER','FIB','FASTPAY','ZAINCASH','ASIAHAWALA','CARD','OTHER']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, expectedVersion, reason, advancePaidUsd, advancePaymentMethod, customerId, ...rest } = input;

        // 1. Load existing order. Soft-deleted orders are already hidden by
        //    getFullPackageOrderById (notDeleted filter applied in Phase 1).
        const existing = await db.getFullPackageOrderById(id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }

        // 2. OCC check — protect against concurrent edits.
        if (expectedVersion !== undefined && (existing.version ?? 1) !== expectedVersion) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This order was modified by someone else. Please reload and try again.",
          });
        }

        // 2a. Customer reassignment guard.
        //     Changing the customer on an order that already has financial
        //     entries (ledger charge, advance payment) or physical linkage
        //     (package / delivery box) would desync money & logistics: the
        //     charge/advance stays on the OLD customer while the order moves
        //     to the NEW one. We only permit reassignment on a fully-clean
        //     order; otherwise the operator must reverse the charge/advance
        //     and unlink the package/box first.
        const customerChanged =
          customerId !== undefined && customerId !== existing.customerId;
        if (customerChanged) {
          // Financial-cleanliness flags (mirror the handler's own
          // isUncharged definition, plus advance + shipping charge).
          const financiallyClean =
            !existing.isCharged &&
            !existing.chargeTransactionId &&
            !(existing as any).isChargedToCustomer &&
            !(existing as any).isShippingCharged &&
            Number((existing as any).advancePaidUsd || 0) === 0 &&
            !(existing as any).advancePaidAt &&
            !(existing as any).advancePaymentTransactionId;

          // Physical linkage. The box check must catch DELIVERED boxes too —
          // those already billed the delivery charge to the OLD customer — so
          // we use isFPOrderBoxedNonCancelled (any box except cancelled), not
          // the active-only isFPOrderInAnyBox.
          const linkedPackages = await db.getPackagesByOrderId(id);
          const boxed = await db.isFPOrderBoxedNonCancelled(id);
          const unlinked = linkedPackages.length === 0 && !boxed;

          if (!financiallyClean || !unlinked) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "ناتوانرێت کڕیار بگۆڕدرێت — ئەم ئۆردەرە چارج کراوە/پێشەکی یان پاکەت/باچی پێوە بەستراوە. سەرەتا چارج/پێشەکی بگەڕێنەوە یان پەیوەندییەکان لاببە. | Can't change the customer: this order is charged/has an advance/is linked to packages or a box. Reverse the charge/advance or unlink first.",
            });
          }

          // Confirm the target customer exists.
          const newCustomer = await db.getCustomerById(customerId);
          if (!newCustomer) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "کڕیاری هەڵبژێردراو نەدۆزرایەوە | Selected customer not found",
            });
          }
        }

        // 2b. Order-number uniqueness — only when the edit actually changes the
        //     number to a non-blank value already held by a DIFFERENT order.
        //     (We don't validate unchanged numbers, so pre-existing duplicates
        //     in legacy data don't block unrelated edits.)
        if (
          rest.orderNumber !== undefined &&
          rest.orderNumber.trim() &&
          rest.orderNumber.trim() !== (existing.orderNumber ?? "").trim()
        ) {
          const dup = await db.getFullPackageOrderByOrderNumber(rest.orderNumber, id);
          if (dup) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `ئەم ئۆردەر نەمبەرە پێشتر بەکارهاتووە لە ئۆردەری ${dup.orderCode}. هەر ئۆردەرێک دەبێت ئۆردەر نەمبەرێکی ناوازەی هەبێت. | This order number is already used by ${dup.orderCode}. Each order must have a unique order number.`,
            });
          }
        }

        // 3. Compute whether the customer-facing charge amount would change.
        //    We merge the incoming edits on top of the current order and
        //    recompute using computeOrderChargeAmount (single source of truth).
        const mergedForCharge = {
          orderType: existing.orderType,
          sellingPriceUsd: (rest.sellingPriceUsd ?? existing.sellingPriceUsd) as any,
          itemPriceUsd: (rest.itemPriceUsd ?? (existing as any).itemPriceUsd) as any,
          commissionFeeUsd: (rest.commissionFeeUsd ?? (existing as any).commissionFeeUsd) as any,
          quantity: rest.quantity ?? existing.quantity,
        };
        const oldChargeAmount = db.computeOrderChargeAmount({
          orderType: existing.orderType,
          sellingPriceUsd: existing.sellingPriceUsd as any,
          itemPriceUsd: (existing as any).itemPriceUsd,
          commissionFeeUsd: (existing as any).commissionFeeUsd,
          quantity: existing.quantity,
        });
        const newChargeAmount = db.computeOrderChargeAmount(mergedForCharge);
        const chargeDelta = newChargeAmount - oldChargeAmount;

        const advanceChanged =
          advancePaidUsd !== undefined &&
          Math.abs(parseFloat(advancePaidUsd || '0') - parseFloat(String(existing.advancePaidUsd || '0'))) > 0.005;

        const chargeChanged = Math.abs(chargeDelta) > 0.005;

        // 4. Money changes require a reason (audit trail) — BUT only for
        //    orders that have already been charged. Pending orders (never
        //    charged, no ledger impact) can be freely edited without a reason.
        const isUncharged = !existing.isCharged && !existing.chargeTransactionId;
        if (!isUncharged && (chargeChanged || advanceChanged) && (!reason || reason.trim().length < 3)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "هۆکار پێویستە (بەلایەنی کەم ٣ پیت) بۆ هەر گۆڕانکاریەک لە پارە. | Reason (min 3 chars) is required when amounts change.",
          });
        }

        // 5. Apply the charge adjustment FIRST — if this fails, the order
        //    is not modified, so no inconsistent state.
        //    If the order has never been charged (chargeTransactionId is
        //    null — e.g. pending_quote purchase_request), skip: there's
        //    nothing in the ledger to adjust yet. When the order gets its
        //    first charge later (via approveQuote or delivery), the full
        //    current price is what will be billed.
        if (chargeChanged && existing.chargeTransactionId) {
          try {
            await db.adjustCharge(
              existing.chargeTransactionId,
              newChargeAmount,
              reason!,
              ctx.user.id,
            );
            appLogger.info("[Order Edit] Adjusted ledger charge", {
              orderId: id,
              orderCode: existing.orderCode,
              oldAmount: oldChargeAmount,
              newAmount: newChargeAmount,
              delta: chargeDelta,
              reason,
            });
          } catch (err) {
            appLogger.error("[Order Edit] Failed to adjust ledger charge", {
              orderId: id,
              error: err instanceof Error ? err.message : String(err),
            });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "هەڵە لە گۆڕینی نرخی ئۆردەر لە دەفتەری هەژمار | Failed to adjust charge on customer ledger",
            });
          }
        }

        // 6. Handle advance payment delta (same logic as before, preserved).
        const data: any = { ...rest };
        // Persist the validated customer reassignment (guard passed in 2a).
        if (customerChanged) {
          data.customerId = customerId;
        }
        if (advancePaidUsd !== undefined) {
          const newAdvance = parseFloat(advancePaidUsd || '0');
          const oldAdvance = parseFloat(String(existing.advancePaidUsd || '0'));
          const delta = newAdvance - oldAdvance;

          if (Math.abs(delta) > 0.005) { // non-trivial change
            const customer = await db.getCustomerById(existing.customerId);
            if (customer) {
              try {
                if (delta > 0) {
                  // Advance increased — record additional CREDIT_PAYMENT
                  const result = await db.recordPaymentReceived(
                    existing.customerId, customer.customerCode, delta, 0,
                    advancePaymentMethod || (existing.advancePaymentMethod as any) || 'CASH',
                    ctx.user.id,
                    `گۆڕینی پارەی پێشەکی (+$${delta.toFixed(2)}) بۆ ئۆردەری ${existing.orderCode} - ${existing.productName} | ${reason}`,
                    undefined, undefined, undefined,
                  );
                  data.advancePaymentTransactionId = result.transaction.id;
                } else {
                  // Advance decreased — reverse the extra amount, linked to the original payment
                  await db.reverseAdvancePayment(
                    existing.customerId, customer.customerCode, Math.abs(delta),
                    `گەڕاندنەوەی بەشێک لە پارەی پێشەکی (-$${Math.abs(delta).toFixed(2)}) بۆ ئۆردەری ${existing.orderCode} - ${existing.productName} | ${reason}`,
                    ctx.user.id,
                    (existing as any).advancePaymentTransactionId || undefined,
                  );
                }
              } catch (err) {
                appLogger.error("[Advance Payment] Failed to adjust advance on order update", {
                  error: err instanceof Error ? err.message : String(err),
                  orderId: id,
                });
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "هەڵە لە گۆڕینی پارەی پێشەکی" });
              }
            }
          }

          data.advancePaidUsd = newAdvance.toFixed(2);
          if (newAdvance > 0) {
            data.advancePaidAt = existing.advancePaidAt || new Date();
            if (advancePaymentMethod) data.advancePaymentMethod = advancePaymentMethod;
          } else {
            data.advancePaidAt = null;
            data.advancePaymentMethod = null;
            data.advancePaymentTransactionId = null;
          }
        }

        // 7. Persist the order changes. updateFullPackageOrder bumps version
        //    automatically (Plan v3), so the next OCC round-trip will see
        //    existing.version + 1.
        await db.updateFullPackageOrder(id, data, ctx.user.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_full_package_order",
          entityType: "full_package_order",
          entityId: id,
          oldValues: existing,
          newValues: { ...data, reason: reason ?? null, chargeDeltaUsd: chargeChanged ? chargeDelta : 0 },
        });

        return {
          success: true,
          newVersion: (existing.version ?? 1) + 1,
          chargeDeltaUsd: chargeChanged ? chargeDelta : 0,
          newChargeAmountUsd: newChargeAmount,
        };
      }),
    
    updateStatus: staffProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending_quote", "quoted", "pending", "approved", "rejected", "ordered", "tracking_added", "in_china_warehouse", "quality_check", "in_batch", "in_transit", "arrived", "ready_for_delivery", "delivered", "cancelled", "refunded", "returned"]),
        trackingNumber: z.string().optional(),
        batchId: z.number().optional(),
        actualPriceUsd: z.string().optional(),
        shippingCostUsd: z.string().optional(),
        weightKg: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        const updateData: Record<string, unknown> = { status: input.status };
        
        // If adding tracking number
        if (input.trackingNumber && !existing.trackingNumber) {
          updateData.trackingNumber = input.trackingNumber;
          updateData.trackingAddedDate = new Date();
          if (input.status === "tracking_added" || existing.status === "ordered") {
            updateData.status = "tracking_added";
          }
        }
        
        // If assigning to batch
        if (input.batchId) {
          updateData.batchId = input.batchId;
          if (input.status === "in_batch") {
            updateData.status = "in_batch";
          }
        }
        
        // Set date fields based on status
        if (input.status === "delivered" && !existing.deliveredDate) {
          updateData.deliveredDate = new Date();
          updateData.actualDeliveryDate = new Date();

          // Auto-split shipping cost across orders sharing the same tracking number
          try {
            await autoSplitShippingByTracking(existing, ctx.user.id);
          } catch (e) {
            appLogger.error('[ShippingSplit] Auto-split failed on delivery', {
              error: e instanceof Error ? e.message : String(e),
              orderId: existing.id,
            });
          }

          // Create revenue record for finance tracking
          // sellingPriceUsd and purchasePriceUsd are PER-UNIT — multiply by quantity
          try {
            const sellingPricePerUnit = parseFloat(existing.sellingPriceUsd || '0');
            const purchasePricePerUnit = parseFloat(existing.purchasePriceUsd || '0');
            const shippingCost = parseFloat(existing.shippingCostUsd || '0');
            const qty = existing.quantity || 1;
            const totalRevenue = sellingPricePerUnit * qty;
            const totalCost = (purchasePricePerUnit * qty) + shippingCost;
            const profit = totalRevenue - totalCost;
            await db.createRevenueRecord({
              recordDate: new Date(),
              revenueType: 'full_package_sale',
              referenceType: 'fullPackageOrder',
              referenceId: existing.id,
              customerId: existing.customerId,
              amountUsd: totalRevenue,
              costUsd: totalCost,
              description: `Full Package - ${existing.orderCode} (${existing.productName})`,
              createdById: ctx.user.id,
            });
            
            // Update daily financial summary with profit
            await db.updateDailyFinancialSummary(new Date(), { addRevenue: totalRevenue, revenueType: 'full_package_sale', addFullPackagesSold: 1 });
          } catch (e) {
            appLogger.error('[Finance] Failed to create revenue record for full package', { error: e instanceof Error ? e.message : String(e) });
          }
        }
        if (input.status === "arrived" && !existing.arrivedDate) {
          updateData.arrivedDate = new Date();
        }
        
        await db.updateFullPackageOrder(input.id, updateData, ctx.user.id);
        
        // Create status history entry
        await db.createFullPackageStatusHistory({
          orderId: input.id,
          previousStatus: existing.status,
          newStatus: input.status,
          changedById: ctx.user.id,
          changedByName: ctx.user.name,
          notes: input.notes,
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_full_package_status",
          entityType: "full_package_order",
          entityId: input.id,
          oldValues: { status: existing.status },
          newValues: updateData,
        });
        
        return { success: true };
      }),
    
    // Get status history for an order
    getStatusHistory: staffProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return db.getFullPackageStatusHistoryByOrderId(input.orderId);
      }),
    
    // Mark order as returned
    markReturned: staffProcedure
      .input(z.object({
        id: z.number(),
        returnReason: z.string(),
        refundAmount: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        await db.updateFullPackageOrder(input.id, {
          isReturned: true,
          returnReason: input.returnReason,
          returnDate: new Date(),
          returnStatus: "requested",
          refundAmount: input.refundAmount,
          status: "returned",
        });
        
        await db.createFullPackageStatusHistory({
          orderId: input.id,
          previousStatus: existing.status,
          newStatus: "returned",
          changedById: ctx.user.id,
          changedByName: ctx.user.name,
          notes: `Return requested: ${input.returnReason}`,
        });
        
        return { success: true };
      }),
    
    // Update quality check
    updateQualityCheck: staffProcedure
      .input(z.object({
        id: z.number(),
        qualityCheckStatus: z.enum(["pending", "passed", "failed", "partial"]),
        qualityCheckNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateFullPackageOrder(input.id, {
          qualityCheckStatus: input.qualityCheckStatus,
          qualityCheckNotes: input.qualityCheckNotes,
          qualityCheckDate: new Date(),
          qualityCheckById: ctx.user.id,
        }, ctx.user.id);
        
        return { success: true };
      }),
    
    /**
     * Plan v3, Phase 3 — safe delete mutation.
     *
     * The old version called db.deleteFullPackageOrder (a hard DELETE) and
     * only reversed the advance payment. This was dangerous: if the order
     * had already been charged (DEBIT on the customer ledger), the DEBIT
     * stayed, the invoice stayed "issued", and the customer balance became
     * permanently inflated with a zombie charge for a now-non-existent
     * order.
     *
     * The new version:
     *   1. Requires a human-readable `reason` (audit trail).
     *   2. Reverses the DEBIT via reverseCharge() → emits an
     *      ADJUSTMENT_CREDIT of equal amount and cancels the linked
     *      invoice. Idempotent (marker-based detection).
     *   3. Reverses the advance CREDIT_PAYMENT via reverseAdvancePayment()
     *      (same as before, but with a cleaner reason string).
     *   4. Cancels the revenue record (handled inside reverseCharge).
     *   5. SOFT-deletes the order via softDeleteFullPackageOrder() instead
     *      of hard DELETE — history is preserved, all listings already
     *      filter by deletedAt IS NULL (Phase 1).
     *   6. Writes a full audit log including the reason and reversed
     *      amounts, so finance can reconcile later.
     */
    delete: adminProcedure
      .input(z.object({
        id: z.number(),
        // Plan v3 — require the admin to explain why. Stored on the order
        // (deletionReason) and in the audit log.
        reason: z.string().min(3, "هۆکار پێویستە (بەلایەنی کەم ٣ پیت)"),
        refundAdvance: z.boolean().default(true),
        expectedVersion: z.number().optional(), // OCC from the delete dialog
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }

        // Can't delete twice — idempotent guard.
        if ((existing as any).deletedAt) {
          return {
            success: true,
            alreadyDeleted: true,
            reversedChargeUsd: 0,
            reversedAdvanceUsd: 0,
          };
        }

        // OCC check.
        if (input.expectedVersion !== undefined && (existing.version ?? 1) !== input.expectedVersion) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This order was modified by someone else. Please reload before deleting.",
          });
        }

        // 1. Reverse the original charge (DEBIT) on the customer ledger.
        //    reverseCharge is idempotent, so re-running a failed delete is
        //    safe. For consolidated invoices, it skips invoice cancellation
        //    when other orders are still active on the same invoice.
        //
        // Edge case: legacy orders may have isCharged=true without a
        // chargeTransactionId (old data before Plan v3). We cannot reverse
        // without the txn id, so we log a warning and proceed with the
        // soft-delete — the ledger for that order stays as-is (it was
        // already baked into the balance). Operators can manually adjust
        // if needed.
        let reversedChargeUsd = 0;
        if ((existing as any).chargeTransactionId) {
          try {
            const result = await db.reverseCharge(
              (existing as any).chargeTransactionId,
              `سڕینەوەی ئۆردەری ${existing.orderCode} - ${existing.productName} | ${input.reason}`,
              ctx.user.id,
            );
            reversedChargeUsd = parseFloat(result.reversalTransaction.amountUsd ?? '0');
            appLogger.info("[Order Delete] Reversed charge", {
              orderId: input.id,
              orderCode: existing.orderCode,
              reversedChargeUsd,
              reason: input.reason,
            });
          } catch (err) {
            const underlying = err instanceof Error ? err.message : String(err);
            appLogger.error("[Order Delete] Failed to reverse charge", {
              orderId: input.id,
              error: underlying,
              stack: err instanceof Error ? err.stack : undefined,
            });
            // Include the underlying error message on the TRPCError so the
            // operator-facing toast shows the real DB-level cause (e.g.
            // "Duplicate entry", "FK constraint", "Transaction not found").
            // Without this the client only sees the generic Kurdish prefix
            // and we cannot diagnose the failure from the UI.
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `هەڵە لە گەڕاندنەوەی نرخی ئۆردەر لە دەفتەری هەژمار | Failed to reverse charge on customer ledger: ${underlying}`,
            });
          }
        } else if ((existing as any).isCharged || (existing as any).isChargedToCustomer) {
          // Legacy inconsistent state: order was marked charged but has no
          // chargeTransactionId to reverse. Log loudly so ops can manually
          // reconcile. The soft-delete continues so the UI isn't blocked.
          appLogger.warn("[Order Delete] Legacy order marked isCharged but has no chargeTransactionId — skipping ledger reversal", {
            orderId: input.id,
            orderCode: existing.orderCode,
            isCharged: (existing as any).isCharged,
            isChargedToCustomer: (existing as any).isChargedToCustomer,
          });
        }

        // 2. Reverse the advance payment (CREDIT_PAYMENT) if requested.
        let reversedAdvanceUsd = 0;
        const advance = parseFloat(String(existing.advancePaidUsd || '0'));
        if (input.refundAdvance && advance > 0) {
          const customer = await db.getCustomerById(existing.customerId);
          if (customer) {
            try {
              await db.reverseAdvancePayment(
                existing.customerId, customer.customerCode, advance,
                `گەڕاندنەوەی پارەی پێشەکی لەبەر سڕینەوەی ئۆردەری ${existing.orderCode} - ${existing.productName} | ${input.reason}`,
                ctx.user.id,
                (existing as any).advancePaymentTransactionId || undefined,
              );
              reversedAdvanceUsd = advance;
              appLogger.info("[Advance Payment] Reversed advance due to order deletion", {
                orderId: input.id, orderCode: existing.orderCode, advance,
              });
            } catch (err) {
              const underlying = err instanceof Error ? err.message : String(err);
              appLogger.error("[Advance Payment] Failed to reverse advance on delete", {
                error: underlying,
                stack: err instanceof Error ? err.stack : undefined,
                orderId: input.id,
              });
              // NOTE on partial state: by the time we get here the charge
              // reversal above has already committed (it's in its own
              // transaction). If the advance reversal then fails, the
              // customer's DEBIT is already gone so they are NOT
              // over-charged — but the advance credit that was booked
              // against this order is still sitting on the account. An
              // operator has to clean that up manually once we know why
              // this is failing.
              //
              // Surface the real DB-level message so the toast actually
              // tells us what happened (duplicate TXN number, FK
              // violation, schema patch not run, etc.). Without this
              // we are flying blind.
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `هەڵە لە گەڕاندنەوەی پارەی پێشەکی | Advance reversal failed: ${underlying}`,
              });
            }
          }
        }

        // 3. Soft-delete the order (preserves history + blocks from listings).
        await db.softDeleteFullPackageOrder(input.id, ctx.user.id, input.reason);

        // 4. Full audit trail.
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_full_package_order",
          entityType: "full_package_order",
          entityId: input.id,
          oldValues: existing,
          newValues: {
            reason: input.reason,
            refundAdvance: input.refundAdvance,
            reversedChargeUsd,
            reversedAdvanceUsd,
            chargeTransactionId: (existing as any).chargeTransactionId ?? null,
            advancePaymentTransactionId: (existing as any).advancePaymentTransactionId ?? null,
          },
        });

        return {
          success: true,
          reversedChargeUsd,
          reversedAdvanceUsd,
        };
      }),
    
    // Get orders needing tracking reminder
    getOverdueOrders: staffProcedure.query(async () => {
      return db.getOrdersNeedingTrackingReminder();
    }),
    
    // Get profit summary
    getProfitSummary: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageProfitSummary(input?.startDate, input?.endDate);
      }),
    
    // Get profit summary grouped by order type
    getProfitSummaryByType: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageProfitSummaryByType(input?.startDate, input?.endDate);
      }),
    
    // Assign multiple orders to a batch
    assignToBatch: staffProcedure
      .input(z.object({
        orderIds: z.array(z.number()),
        batchId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        for (const orderId of input.orderIds) {
          await db.updateFullPackageOrder(orderId, {
            batchId: input.batchId,
            status: "in_batch",
          }, ctx.user.id);
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "assign_full_package_to_batch",
          entityType: "full_package_order",
          newValues: input,
        });
        
        return { success: true, count: input.orderIds.length };
      }),
    
    // Reports
    getProfitBySupplier: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageProfitBySupplier(input?.startDate, input?.endDate);
      }),
    
    getProfitByCustomer: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageProfitByCustomer(input?.startDate, input?.endDate);
      }),
    
    getReturnsReport: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageReturnsReport(input?.startDate, input?.endDate);
      }),
    
    getDeliveryTimeReport: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageDeliveryTimeReport(input?.startDate, input?.endDate);
      }),
    
    // ============ TRACKING ALERT SYSTEM ============
    
    // Get tracking alert statistics
    getTrackingAlertStats: staffProcedure.query(async () => {
      return db.getTrackingAlertStats();
    }),
    
    // Get orders pending tracking
    getOrdersPendingTracking: staffProcedure.query(async () => {
      const orders = await db.getOrdersPendingTracking();
      const now = new Date();
      
      // Calculate days waiting and alert level for each order
      return orders.map(order => {
        const orderDate = order.orderDate ? new Date(order.orderDate) : null;
        const daysWaiting = orderDate ? Math.floor((now.getTime() - orderDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
        
        let alertLevel: "none" | "warning" | "urgent" | "critical" = "none";
        if (daysWaiting >= 7) alertLevel = "critical";
        else if (daysWaiting >= 5) alertLevel = "urgent";
        else if (daysWaiting >= 3) alertLevel = "warning";
        
        return {
          ...order,
          daysWaiting,
          calculatedAlertLevel: alertLevel,
        };
      });
    }),
    
    // Get orders by alert level
    getOrdersByAlertLevel: staffProcedure
      .input(z.object({ alertLevel: z.enum(["warning", "urgent", "critical"]) }))
      .query(async ({ input }) => {
        return db.getOrdersByAlertLevel(input.alertLevel);
      }),
    
    // Process and update all alert levels
    processAlerts: staffProcedure.mutation(async ({ ctx }) => {
      const result = await db.processTrackingAlerts();
      
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "process_tracking_alerts",
        entityType: "system",
        entityId: 0,
        newValues: result,
      });
      
      return result;
    }),

    // Multi-tracking per order
    getOrderTrackings: staffProcedure
      .input(z.object({ fullPackageOrderId: z.number() }))
      .query(async ({ input }) => db.getOrderTrackings(input.fullPackageOrderId)),
    addOrderTrackings: staffProcedure
      .input(z.object({
        fullPackageOrderId: z.number(),
        trackingNumbers: z.array(z.string().min(1)).min(1),
      }))
      .mutation(async ({ input }) => db.addOrderTrackings(input.fullPackageOrderId, input.trackingNumbers)),
    removeOrderTracking: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => db.removeOrderTracking(input.id)),
    
    // Get supplier tracking performance
    getSupplierTrackingPerformance: staffProcedure.query(async () => {
      return db.getSupplierTrackingPerformance();
    }),
    
    // ============ PURCHASE REQUEST PROCEDURES ============
    
    // Quote a purchase request (staff sets the price)
    quoteOrder: staffProcedure
      .input(z.object({
        id: z.number(),
        purchasePriceUsd: z.string(), // Our cost
        sellingPriceUsd: z.string(), // Price to customer
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        if (existing.status !== 'pending_quote') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not pending quote" });
        }
        
        // Calculate gross profit
        const selling = parseFloat(input.sellingPriceUsd);
        const purchase = parseFloat(input.purchasePriceUsd);
        const grossProfitUsd = (selling - purchase).toFixed(2);
        
        await db.updateFullPackageOrder(input.id, {
          purchasePriceUsd: input.purchasePriceUsd,
          sellingPriceUsd: input.sellingPriceUsd,
          grossProfitUsd,
          status: 'quoted',
        }, ctx.user.id);
        
        await db.createFullPackageStatusHistory({
          orderId: input.id,
          previousStatus: existing.status,
          newStatus: 'quoted',
          changedById: ctx.user.id,
          changedByName: ctx.user.name,
          notes: input.notes || `Quoted: $${input.sellingPriceUsd}`,
        });
        
        // TODO: Send notification to customer about the quote
        
        return { success: true };
      }),
    
    // Customer approves a quoted order
    approveQuote: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        // Verify customer owns this order
        if (existing.customerId !== ctx.user.id && ctx.user.role !== 'admin' && ctx.user.role !== 'employee') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
        }
        
        if (existing.status !== 'quoted') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not quoted" });
        }
        
        // sellingPriceUsd is PER-UNIT price — multiply by quantity for total
        const sellingPricePerUnit = parseFloat(existing.sellingPriceUsd || '0');
        const quantity = existing.quantity || 1;
        const totalSellingPrice = sellingPricePerUnit * quantity;
        
        // Charge customer account using unified applyCharge function
        const customerForOrder = await db.getCustomerById(existing.customerId);
        if (!customerForOrder) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        }
        
        // applyCharge automatically creates ledger transaction and invoice
        const approveChargeResult = await db.applyCharge(
          existing.customerId,
          customerForOrder.customerCode,
          'FULL_PACKAGE',
          existing.id,
          totalSellingPrice,
          `Full Package Order - ${existing.orderCode} (${existing.productName}) - ${quantity} pcs`,
          ctx.user.id,
          [{
            description: `${existing.productName} (${existing.orderCode})`,
            quantity: quantity,
            unitPrice: sellingPricePerUnit,
            total: totalSellingPrice,
          }]
        );

        // Update order status + persist chargeTransactionId (Plan v3)
        await db.updateFullPackageOrder(input.id, {
          status: 'approved',
          isPaid: true,
          paidFromBalanceUsd: totalSellingPrice.toFixed(2),
          chargeTransactionId: approveChargeResult.transaction.id,
        }, ctx.user.id);
        
        await db.createFullPackageStatusHistory({
          orderId: input.id,
          previousStatus: existing.status,
          newStatus: 'approved',
          changedById: ctx.user.id,
          changedByName: ctx.user.name,
          notes: `Customer approved and paid $${totalSellingPrice.toFixed(2)}`,
        });
        
        return { success: true };
      }),
    
    // Customer rejects a quoted order
    rejectQuote: protectedProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        // Verify customer owns this order
        if (existing.customerId !== ctx.user.id && ctx.user.role !== 'admin' && ctx.user.role !== 'employee') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
        }
        
        if (existing.status !== 'quoted') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not quoted" });
        }
        
        await db.updateFullPackageOrder(input.id, {
          status: 'rejected',
        }, ctx.user.id);
        
        await db.createFullPackageStatusHistory({
          orderId: input.id,
          previousStatus: existing.status,
          newStatus: 'rejected',
          changedById: ctx.user.id,
          changedByName: ctx.user.name,
          notes: input.reason || 'Customer rejected the quote',
        });
        
        return { success: true };
      }),
    
    // Charge shipping cost when batch arrives (for full_package orders)
    chargeShippingCost: staffProcedure
      .input(z.object({
        id: z.number(),
        shippingCostUsd: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        if (existing.isChargedToCustomer) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Shipping already charged" });
        }
        
        const shippingCost = parseFloat(input.shippingCostUsd);
        const grossProfit = parseFloat(existing.grossProfitUsd || '0');
        const netProfitUsd = (grossProfit - shippingCost).toFixed(2);
        
        await db.updateFullPackageOrder(input.id, {
          shippingCostUsd: input.shippingCostUsd,
          netProfitUsd,
          isChargedToCustomer: true,
          chargedAt: new Date(),
        }, ctx.user.id);
        
        return { success: true, netProfitUsd };
      }),
    
    // ============ COMMISSION ORDER PROCEDURES ============
    
    // Create commission order with prepaid
    createCommissionOrder: staffProcedure
      .input(z.object({
        customerId: z.number(),
        productName: z.string().min(1),
        productLink: z.string().optional(),
        productImage: z.string().optional(),
        productImages: z.array(z.string()).optional(),
        productDescription: z.string().optional(),
        quantity: z.number().min(1).default(1),
        color: z.string().optional(),
        size: z.string().optional(),
        productType: z.string().optional(),
        itemPriceUsd: z.string(), // Actual item price (customer knows)
        itemPriceCny: z.string().optional(),
        commissionFeeUsd: z.string(), // Service fee
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const orderCode = `CM-${Date.now().toString(36).toUpperCase()}`;
        
        // Both figures are PER-UNIT — see db.commissionGoodsTotal.
        const itemPricePerUnit = parseFloat(input.itemPriceUsd);
        const commission = parseFloat(input.commissionFeeUsd);
        const quantity = input.quantity || 1;
        const totalPrepaid = db.commissionGoodsTotal(itemPricePerUnit, commission, quantity);
        
        // Charge customer account using unified applyCharge function
        const customerForCommission = await db.getCustomerById(input.customerId);
        if (!customerForCommission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        }
        
        // Plan v3: create the order FIRST so applyCharge can reference the
        // real order.id (was previously charging with referenceId=0, which
        // made the charge un-reversible by the new safe-edit/delete path).
        const order = await db.createFullPackageOrder({
          ...input,
          orderCode,
          orderType: 'commission',
          status: 'pending',
          totalPrepaidUsd: totalPrepaid.toFixed(2),
          isPrepaid: true,
          prepaidAt: new Date(),
          isPaid: true,
          paidFromBalanceUsd: totalPrepaid.toFixed(2),
          // Commission is our profit — per unit, so it scales with quantity.
          grossProfitUsd: db.commissionProfit(commission, quantity).toFixed(2),
          createdById: ctx.user.id,
        });

        // applyCharge automatically creates ledger transaction and invoice.
        // Per spec: render ONE combined "item price" line that already
        // includes commission — no separate commission line item, no
        // qty × unit + commission breakdown. The unitPrice/total columns on
        // the rendered invoice carry the combined number directly.
        const productDescParts: string[] = [`🛍️ ${input.productName}`];
        productDescParts.push(`کۆدی ئۆردەر: ${orderCode}`);
        if (input.color) productDescParts.push(`ڕەنگ: ${input.color}`);
        if (input.size) productDescParts.push(`قەبارە: ${input.size}`);
        if (input.productDescription) productDescParts.push(`وەسف: ${input.productDescription}`);

        const commissionChargeResult = await db.applyCharge(
          input.customerId,
          customerForCommission.customerCode,
          'COMMISSION',
          order.id,
          totalPrepaid,
          `کڕینی عمولە - ${input.productName} (نرخی کاڵا: $${totalPrepaid.toFixed(2)})`,
          ctx.user.id,
          [
            {
              description: productDescParts.join('\n'),
              quantity: quantity,
              unitPrice: quantity > 0 ? totalPrepaid / quantity : totalPrepaid,
              total: totalPrepaid,
            },
          ]
        );

        // Persist chargeTransactionId on the order (Plan v3).
        await db.updateFullPackageOrder(order.id, {
          chargeTransactionId: commissionChargeResult.transaction.id,
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_commission_order",
          entityType: "full_package_order",
          entityId: order.id,
          newValues: input,
        });
        
        return order;
      }),
    
    // Get customer's purchase requests (for customer portal)
    getMyPurchaseRequests: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return db.getFullPackageOrdersByCustomer(ctx.user.id, {
          orderType: 'purchase_request',
          status: input?.status,
        });
      }),
    
    // Get customer's full package orders (for customer portal)
    getMyOrders: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        orderType: z.enum(["full_package", "purchase_request", "commission"]).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return db.getFullPackageOrdersByCustomer(ctx.user.id, input);
      }),
    
    // ============ PROFIT REPORTS ============
    
    // Get detailed profit report for Full Package orders
    getProfitReport: adminProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        orderType: z.enum(["full_package", "purchase_request", "commission"]).optional(),
        customerId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageProfitReport(input);
      }),
    
    // Get monthly profit report
    getMonthlyProfitReport: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getMonthlyProfitReport(input.year, input.month);
      }),
    
    // Get profit breakdown by order type
    getProfitByOrderType: adminProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getProfitByOrderType(input?.startDate, input?.endDate);
      }),

    getAggregatedProfitAndExpenses: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12).optional(),
      }))
      .query(async ({ input }) => {
        return db.getAggregatedProfitAndExpenses(input.year, input.month);
      }),

    // Get all orders sharing a tracking number (for split shipping UI)
    getOrdersByTracking: staffProcedure
      .input(z.object({ trackingNumber: z.string().min(1) }))
      .query(async ({ input }) => {
        return db.getAllOrdersByTrackingNumber(input.trackingNumber);
      }),

    // Split shipping cost across orders sharing a tracking number
    splitShippingCost: staffProcedure
      .input(z.object({
        trackingNumber: z.string().min(1),
        totalShippingCost: z.number().min(0),
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const orders = await db.getAllOrdersByTrackingNumber(input.trackingNumber);
        if (orders.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No orders found for this tracking number" });
        }

        const isSea = input.shippingType === "sea";
        const results: { orderId: number; orderCode: string; share: number; weight?: number; cbm?: number; ratio: number }[] = [];

        if (orders.length === 1) {
          // Single order - full cost
          await db.updateFullPackageOrder(orders[0].id, {
            shippingCostUsd: input.totalShippingCost.toFixed(2),
            shippingType: input.shippingType,
          }, ctx.user.id);
          results.push({
            orderId: orders[0].id,
            orderCode: orders[0].orderCode,
            share: input.totalShippingCost,
            ratio: 1,
          });
        } else {
          // Multiple orders - split by weight (air) or CBM (sea)
          let totalMeasure = 0;
          const orderMeasures: { order: typeof orders[0]; measure: number }[] = [];

          for (const order of orders) {
            let measure = 0;
            if (isSea) {
              measure = parseFloat(order.volumeCbm?.toString() || "0") || 0;
            } else {
              // Air: use chargeable weight (max of actual and volumetric)
              const actualKg = parseFloat(order.weightKg?.toString() || "0") || 0;
              const length = parseFloat(order.dimensionLength?.toString() || "0") || 0;
              const width = parseFloat(order.dimensionWidth?.toString() || "0") || 0;
              const height = parseFloat(order.dimensionHeight?.toString() || "0") || 0;
              const volumetricKg = (length * width * height) / 6000;
              measure = Math.max(actualKg, volumetricKg);
            }
            orderMeasures.push({ order, measure });
            totalMeasure += measure;
          }

          // If no orders have weight/CBM data, split equally
          const useEqual = totalMeasure === 0;

          for (const { order, measure } of orderMeasures) {
            const ratio = useEqual ? (1 / orders.length) : (measure / totalMeasure);
            const share = Math.round(input.totalShippingCost * ratio * 100) / 100;

            await db.updateFullPackageOrder(order.id, {
              shippingCostUsd: share.toFixed(2),
              shippingType: input.shippingType,
            }, ctx.user.id);

            results.push({
              orderId: order.id,
              orderCode: order.orderCode,
              share,
              weight: isSea ? undefined : measure,
              cbm: isSea ? measure : undefined,
              ratio: Math.round(ratio * 10000) / 100, // percentage with 2 decimals
            });
          }

          // Fix rounding: adjust first order to ensure total matches exactly
          const totalAssigned = results.reduce((sum, r) => sum + r.share, 0);
          const diff = Math.round((input.totalShippingCost - totalAssigned) * 100) / 100;
          if (diff !== 0 && results.length > 0) {
            results[0].share = Math.round((results[0].share + diff) * 100) / 100;
            await db.updateFullPackageOrder(results[0].orderId, {
              shippingCostUsd: results[0].share.toFixed(2),
            }, ctx.user.id);
          }
        }

        appLogger.info("[ShippingSplit] Split shipping cost across orders", {
          trackingNumber: input.trackingNumber,
          totalCost: input.totalShippingCost,
          orderCount: orders.length,
          results,
        });

        return { trackingNumber: input.trackingNumber, totalShippingCost: input.totalShippingCost, orders: results };
      }),
});

