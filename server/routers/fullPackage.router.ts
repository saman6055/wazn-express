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
          if (!totalPrepaid && input.itemPriceUsd) {
            // itemPriceUsd is PER-UNIT — multiply by quantity for total
            const qty = input.quantity || 1;
            totalPrepaid = ((itemPrice * qty) + commissionFee).toFixed(2);
          }
          // Commission is our profit
          grossProfitUsd = commissionFee.toFixed(2);
        }
        
        const order = await db.createFullPackageOrder({
          ...input,
          orderCode,
          status: initialStatus,
          grossProfitUsd,
          totalPrepaidUsd: totalPrepaid,
          orderDate: input.orderDate || (input.orderNumber ? new Date() : undefined),
          createdById: ctx.user.id,
          // Mark as paid for commission orders
          isPrepaid: input.orderType === 'commission' ? true : undefined,
          prepaidAt: input.orderType === 'commission' ? new Date() : undefined,
          isPaid: input.orderType === 'commission' ? true : undefined,
          paidFromBalanceUsd: input.orderType === 'commission' ? totalPrepaid : undefined,
          // IMPORTANT: Mark commission orders as charged at creation to prevent double charging at delivery
          // Commission orders are charged upfront (itemPrice + commissionFee), shipping is charged separately at delivery
          isCharged: input.orderType === 'commission' ? true : undefined,
          isChargedToCustomer: input.orderType === 'commission' ? true : undefined,
          chargedAt: input.orderType === 'commission' ? new Date() : undefined,
        });
        
        // For commission orders, automatically charge customer and create invoice
        if (input.orderType === 'commission' && totalPrepaid) {
          const customer = await db.getCustomerById(input.customerId);
          if (customer) {
            const totalAmount = parseFloat(totalPrepaid);
            const quantity = input.quantity || 1;
            
            // Create line items for invoice - show only total price
            const lineItems = [
              {
                description: `${input.productName}`,
                quantity: quantity,
                unitPrice: totalAmount / quantity,
                total: totalAmount,
              },
            ];
            
            // Apply charge - this creates ledger transaction and invoice
            await db.applyCharge(
              input.customerId,
              customer.customerCode,
              'COMMISSION',
              order.id,
              totalAmount,
              `کڕینی عمولە - ${input.productName}`,
              ctx.user.id,
              lineItems
            );
            
            appLogger.info("[Commission] Auto-charged customer for order", { customerCode: customer.customerCode, orderCode, totalAmount });
          }
        }

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
              if (!totalPrepaid && item.itemPriceUsd) {
                totalPrepaid = (itemPrice + commissionFee).toFixed(2);
              }
              grossProfitUsd = commissionFee.toFixed(2);
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
              isPrepaid: input.orderType === 'commission' ? true : undefined,
              prepaidAt: input.orderType === 'commission' ? new Date() : undefined,
              isPaid: input.orderType === 'commission' ? true : undefined,
              paidFromBalanceUsd: input.orderType === 'commission' ? totalPrepaid : undefined,
              isCharged: input.orderType === 'commission' ? true : undefined,
              isChargedToCustomer: input.orderType === 'commission' ? true : undefined,
              chargedAt: input.orderType === 'commission' ? new Date() : undefined,
            });
            
            // For commission orders, charge customer
            if (input.orderType === 'commission' && totalPrepaid) {
              const customer = await db.getCustomerById(input.customerId);
              if (customer) {
                const totalAmount = parseFloat(totalPrepaid);
                const quantity = item.quantity || 1;
                const lineItems = [
                  {
                    description: `${item.productName}`,
                    quantity: quantity,
                    unitPrice: totalAmount / quantity,
                    total: totalAmount,
                  },
                ];
                await db.applyCharge(
                  input.customerId,
                  customer.customerCode,
                  'COMMISSION',
                  order.id,
                  totalAmount,
                  `کڕینی عمولە - ${item.productName}`,
                  ctx.user.id,
                  lineItems
                );
              }
            }

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
    
    update: staffProcedure
      .input(z.object({
        id: z.number(),
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
        // Shipping
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]).optional(),
        shippingCostUsd: z.string().optional(),
        weightKg: z.string().optional(),
        volumeCbm: z.string().optional(),
        dimensionLength: z.string().optional(),
        dimensionWidth: z.string().optional(),
        dimensionHeight: z.string().optional(),
        // Order info
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
        const { id, advancePaidUsd, advancePaymentMethod, ...rest } = input;
        const existing = await db.getFullPackageOrderById(id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }

        // Handle advance payment delta if changed
        const data: any = { ...rest };
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
                    `گۆڕینی پارەی پێشەکی (+$${delta.toFixed(2)}) بۆ ئۆردەری ${existing.orderCode} - ${existing.productName}`,
                    undefined, undefined, undefined,
                  );
                  data.advancePaymentTransactionId = result.transaction.id;
                } else {
                  // Advance decreased — reverse the extra amount, linked to the original payment
                  await db.reverseAdvancePayment(
                    existing.customerId, customer.customerCode, Math.abs(delta),
                    `گەڕاندنەوەی بەشێک لە پارەی پێشەکی (-$${Math.abs(delta).toFixed(2)}) بۆ ئۆردەری ${existing.orderCode} - ${existing.productName}`,
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

        await db.updateFullPackageOrder(id, data, ctx.user.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_full_package_order",
          entityType: "full_package_order",
          entityId: id,
          oldValues: existing,
          newValues: data,
        });

        return { success: true };
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
    
    delete: adminProcedure
      .input(z.object({
        id: z.number(),
        refundAdvance: z.boolean().default(true), // If true, reverses any advance payment
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }

        // Reverse advance payment if any
        const advance = parseFloat(String(existing.advancePaidUsd || '0'));
        if (input.refundAdvance && advance > 0) {
          const customer = await db.getCustomerById(existing.customerId);
          if (customer) {
            try {
              await db.reverseAdvancePayment(
                existing.customerId, customer.customerCode, advance,
                `گەڕاندنەوەی پارەی پێشەکی لەبەر سڕینەوەی ئۆردەری ${existing.orderCode} - ${existing.productName}`,
                ctx.user.id,
                (existing as any).advancePaymentTransactionId || undefined,
              );
              appLogger.info("[Advance Payment] Reversed advance due to order deletion", {
                orderId: input.id, orderCode: existing.orderCode, advance,
              });
            } catch (err) {
              appLogger.error("[Advance Payment] Failed to reverse advance on delete", {
                error: err instanceof Error ? err.message : String(err),
                orderId: input.id,
              });
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "هەڵە لە گەڕاندنەوەی پارەی پێشەکی" });
            }
          }
        }

        await db.deleteFullPackageOrder(input.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_full_package_order",
          entityType: "full_package_order",
          entityId: input.id,
          oldValues: existing,
          newValues: { refundAdvance: input.refundAdvance, reversedAdvanceUsd: advance },
        });

        return { success: true, reversedAdvanceUsd: input.refundAdvance && advance > 0 ? advance : 0 };
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
        await db.applyCharge(
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
        
        // Update order status
        await db.updateFullPackageOrder(input.id, {
          status: 'approved',
          isPaid: true,
          paidFromBalanceUsd: totalSellingPrice.toFixed(2),
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
        
        // itemPriceUsd is PER-UNIT — multiply by quantity for total
        const itemPricePerUnit = parseFloat(input.itemPriceUsd);
        const commission = parseFloat(input.commissionFeeUsd);
        const quantity = input.quantity || 1;
        const itemTotal = itemPricePerUnit * quantity;
        const totalPrepaid = itemTotal + commission;
        
        // Charge customer account using unified applyCharge function
        const customerForCommission = await db.getCustomerById(input.customerId);
        if (!customerForCommission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        }
        
        // applyCharge automatically creates ledger transaction and invoice
        // We'll create the order first to get the ID for reference
        const tempOrderCode = `CM-${Date.now().toString(36).toUpperCase()}`;
        
        // Note: We need to create order first, then charge, so we can reference the order ID
        // For now, use 0 as reference and update later, or restructure the flow
        await db.applyCharge(
          input.customerId,
          customerForCommission.customerCode,
          'COMMISSION',
          0, // Will be updated with actual order ID
          totalPrepaid,
          `Commission Purchase - ${input.productName} (Item: $${itemTotal}, Commission: $${commission})`,
          ctx.user.id,
          [
            {
              description: `${input.productName} - Item Price`,
              quantity: quantity,
              unitPrice: itemPricePerUnit,
              total: itemTotal,
            },
            {
              description: 'Commission Fee',
              quantity: 1,
              unitPrice: commission,
              total: commission,
            },
          ]
        );
        
        // Create order
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
          grossProfitUsd: commission.toFixed(2), // Commission is our profit from the order itself
          createdById: ctx.user.id,
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

