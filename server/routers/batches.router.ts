import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { appLogger } from "../utils/logger";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { notifyBatchStatusChange } from "../services/notification.service";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";

export const batchesRouter = router({
    list: staffProcedure
      .input(z.object({ page: z.number().min(1).optional(), pageSize: z.number().min(1).max(100).optional() }).optional())
      .query(async ({ input }) => {
        const result = await db.getAllBatches({ page: input?.page, pageSize: input?.pageSize });
        const batchIds = result.data.map((b) => b.id);
        const pricingByBatch = batchIds.length > 0 ? await db.getBatchCustomerPricingForBatches(batchIds) : new Map<number, { customerId: number; pricePerKg?: string; pricePerCbm?: string }[]>();
        const batchesWithPricingInfo = result.data.map((batch) => {
          const customerPricing = pricingByBatch.get(batch.id) ?? [];
          return {
            ...batch,
            hasCustomerPricing: customerPricing.length > 0,
            customerPricingCount: customerPricing.length,
          };
        });
        // When pagination params provided, return full shape; otherwise return array for backward compat
        if (input?.page !== undefined || input?.pageSize !== undefined) {
          return { ...result, data: batchesWithPricingInfo };
        }
        return batchesWithPricingInfo;
      }),
    getActive: staffProcedure.query(async () => {
      return db.getActiveBatches();
    }),
    getById: staffProcedure
      .input(z.object({ id: idSchema }))
      .query(async ({ input }) => {
        return db.getBatchById(input.id);
      }),
    getPackages: staffProcedure
      .input(z.object({ batchId: idSchema }))
      .query(async ({ input }) => {
        return db.getPackagesByBatch(input.batchId);
      }),
    create: staffProcedure
      .input(z.object({
        batchCode: batchCodeSchema,
        originWarehouseId: idSchema,
        destinationCountryId: idSchema,
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]),
        carrierInfo: z.string().max(500).optional(),
        // Detailed shipping info
        airlineName: z.string().max(100).optional(),
        flightNumber: z.string().max(50).optional(),
        shippingCompany: z.string().max(100).optional(),
        containerNumber: z.string().max(50).optional(),
        vesselName: z.string().max(100).optional(),
        shippingCost: z.string().max(50).optional(),
        departureDate: z.date().optional(),
        estimatedArrival: z.date().optional(),
        // Actual measurements
        actualWeightKg: z.string().max(50).optional(),
        actualCbm: z.string().max(50).optional(),
        // Charged measurements (what we pay)
        chargedWeightKg: z.string().max(50).optional(),
        chargedCbm: z.string().max(50).optional(),
        // Cost fields (our cost)
        costPerKg: z.string().max(50).optional(),
        costPerCbm: z.string().max(50).optional(),
        // Selling price fields
        pricePerKg: z.string().max(50).optional(),
        pricePerCbm: z.string().max(50).optional(),
        // Tiered pricing
        useTieredPricing: z.boolean().optional(),
        pricingTiers: z.array(z.object({
          minValue: z.string().max(50),
          maxValue: z.string().max(50).nullable(),
          pricePerUnit: z.string().max(50),
        })).optional(),
        // Customer-specific pricing
        customerPricing: z.array(z.object({
          customerId: idSchema,
          pricePerKg: z.string().max(50).optional(),
          pricePerCbm: z.string().max(50).optional(),
          notes: z.string().max(500).optional(),
        })).optional(),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { pricingTiers, customerPricing, ...batchData } = input;
        const batch = await db.createBatch({
          ...batchData,
          createdById: ctx.user.id,
        });
        
        // Create pricing tiers if provided
        if (pricingTiers && pricingTiers.length > 0) {
          await db.setBatchPricingTiers(batch.id, pricingTiers.map((tier, index) => ({
            minValue: tier.minValue,
            maxValue: tier.maxValue,
            pricePerUnit: tier.pricePerUnit,
            sortOrder: index,
          })));
        }
        
        // Create customer-specific pricing if provided
        if (customerPricing && customerPricing.length > 0) {
          await db.setBatchCustomerPricing(batch.id, customerPricing.map(cp => ({
            customerId: cp.customerId,
            pricePerKg: cp.pricePerKg,
            pricePerCbm: cp.pricePerCbm,
            notes: cp.notes,
            createdById: ctx.user.id,
          })));
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_batch",
          entityType: "batch",
          entityId: batch.id,
          newValues: input,
        });
        return batch;
      }),
    updateStatus: staffProcedure
      .input(z.object({
        id: idSchema,
        status: z.enum(["preparing", "in_transit", "arrived", "customs", "delivered", "closed"]),
        actualArrival: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateBatch(id, data);
        
        // Update all packages in batch if status changes
        if (input.status === "in_transit") {
          const packages = await db.getPackagesByBatch(id);
          for (const pkg of packages) {
            await db.updatePackage(pkg.id, { status: "in_transit" });
          }
          // Notify customers about batch departure
          try {
            await notifyBatchStatusChange(id, "batch_departed");
          } catch (e) {
            appLogger.error("[Notification] Failed to send batch departure notification", { error: e instanceof Error ? e.message : String(e) });
          }
        } else if (input.status === "arrived" || input.status === "customs") {
          const packages = await db.getPackagesByBatch(id);
          for (const pkg of packages) {
            await db.updatePackage(pkg.id, { status: "customs_processing" });
          }
          // Notify customers about batch arrival
          try {
            await notifyBatchStatusChange(id, "batch_arrived");
          } catch (e) {
            appLogger.error("[Notification] Failed to send batch arrival notification", { error: e instanceof Error ? e.message : String(e) });
          }
        } else if (input.status === "delivered" || input.status === "closed") {
          // When batch is delivered or closed (CONSOLIDATED INVOICE MODEL):
          //
          // For each customer in this batch, we generate AT MOST 3 invoices:
          //   1. INV-PKG-*  — all normal packages (not linked to FP/commission)
          //   2. INV-FP-*   — all Full Package / Purchase Request orders
          //   3. INV-CM-*   — all Commission orders (item + commission + shipping, combined)
          //
          // Two-phase design:
          //   Phase 1 — collect (no invoices/ledger side effects except package status)
          //   Phase 2 — build one invoice per (customer, type), linking all relevant
          //             ledger transactions to it via applyChargeToInvoice().
          //
          // Legacy orders that were already charged at creation (isCharged=true)
          // are skipped — their old invoices stay untouched.
          const packages = await db.getPackagesByBatch(id);
          const batch = await db.getBatchById(id);

          // Batch-level pricing (used for per-package shipping calculation)
          const pricePerKg = batch ? parseFloat(batch.pricePerKg?.toString() || "0") : 0;
          const pricePerCbm = batch ? parseFloat(batch.pricePerCbm?.toString() || "0") : 0;
          const isSea = batch?.shippingType === 'sea';

          // Consolidation buckets — one entry per (customer, order/pkg).
          type FpItem = { order: any; chargeAmount: number; shippingShare: number; pkg: any };
          type CmItem = { order: any; chargeAmount: number; shippingShare: number; pkg: any };
          const fpOrdersByCustomer = new Map<number, FpItem[]>();
          const commissionOrdersByCustomer = new Map<number, CmItem[]>();
          const packagesByCustomer = new Map<number, typeof packages>();

          // ===== PHASE 1: COLLECT =====
          for (const pkg of packages) {
            // Update package status to delivered
            await db.updatePackage(pkg.id, {
              status: "delivered",
              deliveredAt: new Date()
            });

            // Check if this package is linked to a Full Package order or Commission.
            //
            // Two sources of linkage (in priority order):
            //   1. pkg.fullPackageOrderId — direct FK set when the package was
            //      created (auto-linked via packages.db.ts createPackage). This
            //      is the most reliable signal: the package PHYSICALLY belongs
            //      to this one order.
            //   2. pkg.trackingNumber — string match against orders. Only used
            //      to discover ADDITIONAL orders that share the same carton
            //      (multi-order tracking). Falls back to this when there's no
            //      direct FK (some legacy packages may not have one).
            //
            // We merge both into a deduped `linkedFPOrders` so the rest of the
            // pipeline doesn't have to care which path the order arrived from.
            let isLinkedToFullPackage = false;
            const linkedFPOrdersMap = new Map<number, any>();

            // Path 1: direct FK
            if (pkg.fullPackageOrderId) {
              const direct = await db.getFullPackageOrderById(pkg.fullPackageOrderId);
              if (direct && !(direct as any).deletedAt) {
                linkedFPOrdersMap.set(direct.id, direct);
              }
            }

            // Path 2: tracking-number lookup (for shared-carton scenario)
            if (pkg.trackingNumber) {
              const byTracking = await db.getAllOrdersByTrackingNumber(pkg.trackingNumber);
              for (const o of byTracking) {
                if (!linkedFPOrdersMap.has(o.id)) linkedFPOrdersMap.set(o.id, o);
              }
            }

            const linkedFPOrders = Array.from(linkedFPOrdersMap.values());

            if (linkedFPOrders.length > 0) {
              {
                isLinkedToFullPackage = true;

                // 1. Calculate total shipping cost for this package
                let shippingCost = 0;
                if (isSea && pricePerCbm > 0) {
                  const cbm = parseFloat(pkg.volumeCbm?.toString() || "0");
                  shippingCost = cbm * pricePerCbm;
                } else if (pricePerKg > 0) {
                  const actualKg = parseFloat(pkg.weightKg?.toString() || "0");
                  const lengthCm = parseFloat(pkg.lengthCm?.toString() || "0");
                  const widthCm = parseFloat(pkg.widthCm?.toString() || "0");
                  const heightCm = parseFloat(pkg.heightCm?.toString() || "0");
                  const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                  const chargeableKg = Math.max(actualKg, volumetricKg);
                  shippingCost = chargeableKg * pricePerKg;
                }

                // 2. Save calculated shipping to package (for reference)
                if (shippingCost > 0) {
                  await db.updatePackage(pkg.id, { calculatedCostUsd: shippingCost.toFixed(2) });
                }

                // 3. Split shipping across orders by weight/CBM
                const shares: { order: typeof linkedFPOrders[0]; share: number }[] = [];
                if (shippingCost > 0) {
                  let totalMeasure = 0;
                  const orderMeasures: { order: typeof linkedFPOrders[0]; measure: number }[] = [];
                  for (const fpOrder of linkedFPOrders) {
                    let measure = 0;
                    if (isSea) {
                      measure = parseFloat(fpOrder.volumeCbm?.toString() || "0") || 0;
                    } else {
                      const oKg = parseFloat(fpOrder.weightKg?.toString() || "0") || 0;
                      const oL = parseFloat(fpOrder.dimensionLength?.toString() || "0") || 0;
                      const oW = parseFloat(fpOrder.dimensionWidth?.toString() || "0") || 0;
                      const oH = parseFloat(fpOrder.dimensionHeight?.toString() || "0") || 0;
                      const oVol = (oL * oW * oH) / 6000;
                      measure = Math.max(oKg, oVol);
                    }
                    orderMeasures.push({ order: fpOrder, measure });
                    totalMeasure += measure;
                  }
                  const useEqual = totalMeasure === 0;
                  for (const { order, measure } of orderMeasures) {
                    const ratio = useEqual ? (1 / linkedFPOrders.length) : (measure / totalMeasure);
                    shares.push({ order, share: Math.round(shippingCost * ratio * 100) / 100 });
                  }
                  // Fix rounding drift so shares sum exactly to shippingCost
                  const totalAssigned = shares.reduce((s, r) => s + r.share, 0);
                  const diff = Math.round((shippingCost - totalAssigned) * 100) / 100;
                  if (diff !== 0 && shares.length > 0) shares[0].share += diff;
                }

                // 4. Collect each order into the appropriate bucket
                //    (skip legacy orders that were already charged at creation —
                //     their old invoices stay untouched, and we don't want to
                //     double-charge them. For commission, we still need to
                //     charge shipping on legacy orders if not yet charged.)
                for (const fpOrder of linkedFPOrders) {
                  if (!fpOrder.customerId) continue;
                  const share = shares.find(s => s.order.id === fpOrder.id)?.share ?? 0;

                  if (fpOrder.isCharged || fpOrder.isChargedToCustomer) {
                    // Legacy path: still charge shipping separately for commission
                    if (fpOrder.orderType === 'commission' && share > 0 && !fpOrder.isShippingCharged) {
                      try {
                        const customer = await db.getCustomerById(fpOrder.customerId);
                        if (customer) {
                          const invoiceNumber = `INV-CM-SHIP-${Date.now()}-${fpOrder.id}`;
                          const invoice = await db.createInvoice({
                            invoiceNumber,
                            customerId: fpOrder.customerId,
                            batchId: id,
                            subtotalUsd: share.toFixed(2),
                            totalUsd: share.toFixed(2),
                            status: "issued",
                            issuedAt: new Date(),
                            lineItems: [{
                              description: `🚚 کرێی گواستنەوە — ${fpOrder.productName}\nکۆدی ئۆردەر: ${fpOrder.orderCode}\nباچ: ${batch?.batchCode || ''}\nشیپینگی دابەشکراو: $${share.toFixed(2)}`,
                              quantity: 1, unitPrice: share, total: share,
                            }],
                            notes: `پسووڵەی گواستنەوەی کڕین بە عمولە ${fpOrder.orderCode} — باچ ${batch?.batchCode || ''}`,
                            createdById: ctx.user.id,
                          });
                          await db.applyChargeToInvoice(
                            fpOrder.customerId, customer.customerCode, 'PACKAGE',
                            fpOrder.id, share,
                            `کڕین بە عمولە ${fpOrder.orderCode} - کرێی گواستنەوە`,
                            ctx.user.id, invoice.id,
                          );
                          const grossProfit = parseFloat(fpOrder.grossProfitUsd || '0');
                          await db.updateFullPackageOrder(fpOrder.id, {
                            isShippingCharged: true,
                            shippingChargedAt: new Date(),
                            shippingChargedUsd: share.toFixed(2),
                            shippingCostUsd: share.toFixed(2),
                            netProfitUsd: (grossProfit - share).toFixed(2),
                            batchId: id,
                          }, ctx.user.id);
                        }
                      } catch (e) {
                        appLogger.error("[Legacy Commission Shipping] Failed", { orderCode: fpOrder.orderCode, error: e instanceof Error ? e.message : String(e) });
                      }
                    }
                    continue;
                  }

                  // Fresh (pending) order — collect for consolidation
                  const chargeAmount = db.computeOrderChargeAmount({
                    orderType: fpOrder.orderType,
                    sellingPriceUsd: fpOrder.sellingPriceUsd as any,
                    itemPriceUsd: (fpOrder as any).itemPriceUsd,
                    commissionFeeUsd: (fpOrder as any).commissionFeeUsd,
                    quantity: fpOrder.quantity,
                  });
                  if (chargeAmount <= 0) {
                    appLogger.warn("[Delivery] Order has zero charge amount — skipping", { orderCode: fpOrder.orderCode });
                    continue;
                  }

                  const item = { order: fpOrder, chargeAmount, shippingShare: share, pkg };
                  if (fpOrder.orderType === 'commission') {
                    const arr = commissionOrdersByCustomer.get(fpOrder.customerId) || [];
                    arr.push(item);
                    commissionOrdersByCustomer.set(fpOrder.customerId, arr);
                  } else {
                    const arr = fpOrdersByCustomer.get(fpOrder.customerId) || [];
                    arr.push(item);
                    fpOrdersByCustomer.set(fpOrder.customerId, arr);
                  }
                }
              }
            }

            // Normal package (not linked to any FP/commission order) — existing consolidation
            if (pkg.customerId && !isLinkedToFullPackage) {
              const existing = packagesByCustomer.get(pkg.customerId) || [];
              existing.push(pkg);
              packagesByCustomer.set(pkg.customerId, existing);
            }
          }

          // ===== PHASE 2: CREATE CONSOLIDATED INVOICES =====

          // --- 2A. ONE INVOICE per customer for all Full Package / Purchase Request orders
          for (const [customerId, fpItems] of Array.from(fpOrdersByCustomer.entries())) {
            try {
              const customer = await db.getCustomerById(customerId);
              if (!customer) continue;

              const lineItems: { description: string; quantity: number; unitPrice: number; total: number }[] = [];
              let totalAmount = 0;

              for (const { order, chargeAmount } of fpItems) {
                const sellingPrice = parseFloat((order.sellingPriceUsd || '0').toString()) || 0;
                const qty = order.quantity || 1;
                const descParts: string[] = [`📦 ${order.productName}`];
                descParts.push(`کۆدی ئۆردەر: ${order.orderCode}`);
                if (order.color) descParts.push(`ڕەنگ: ${order.color}`);
                if (order.size) descParts.push(`قەبارە: ${order.size}`);
                if (order.trackingNumber) descParts.push(`تراکینگ: ${order.trackingNumber}`);
                descParts.push(`نرخی فرۆشتن: ${qty} × $${sellingPrice.toFixed(2)} = $${chargeAmount.toFixed(2)}`);
                lineItems.push({
                  description: descParts.join('\n'),
                  quantity: qty,
                  unitPrice: sellingPrice,
                  total: chargeAmount,
                });
                totalAmount += chargeAmount;
              }

              if (totalAmount <= 0) continue;

              // Sum advance payments across all orders in this FP invoice
              let totalAdvancePaid = 0;
              const advanceTxnIds: number[] = [];
              const advanceDetails: { orderCode: string; amount: number; method: string }[] = [];
              for (const { order } of fpItems) {
                const adv = parseFloat((order.advancePaidUsd || '0').toString()) || 0;
                if (adv > 0) {
                  totalAdvancePaid += adv;
                  if ((order as any).advancePaymentTransactionId) {
                    advanceTxnIds.push((order as any).advancePaymentTransactionId);
                  }
                  advanceDetails.push({
                    orderCode: order.orderCode,
                    amount: adv,
                    method: (order as any).advancePaymentMethod || 'CASH',
                  });
                }
              }
              const remainingDue = Math.max(0, totalAmount - totalAdvancePaid);
              const invoiceStatus: 'issued' | 'partially_paid' | 'paid' =
                totalAdvancePaid <= 0 ? 'issued'
                  : totalAdvancePaid >= totalAmount ? 'paid'
                    : 'partially_paid';

              const typeLabel = isSea ? 'دەریایی' : (batch?.shippingType === 'air_irregular' ? 'ئاسمانی نائاسایی' : 'ئاسمانی ئاسایی');
              const invoiceNumber = `INV-FP-${batch?.batchCode || 'B'}-${customer.customerCode}-${Date.now()}`;
              const invoice = await db.createInvoice({
                invoiceNumber,
                customerId,
                batchId: id,
                subtotalUsd: totalAmount.toFixed(2),
                totalUsd: totalAmount.toFixed(2),
                status: invoiceStatus,
                issuedAt: new Date(),
                paidAt: invoiceStatus === 'paid' ? new Date() : null,
                lineItems,
                notes: [
                  `📦 پسووڵەی گەیاندنی فول پاکیج`,
                  `باچ: ${batch?.batchCode || ''} (${typeLabel})`,
                  `ژمارەی ئۆردەر: ${fpItems.length}`,
                  `کۆی گشتی: $${totalAmount.toFixed(2)}`,
                  ...(totalAdvancePaid > 0 ? [
                    `─────────────`,
                    `💰 پارەی پێشەکی دراو: $${totalAdvancePaid.toFixed(2)}`,
                    ...advanceDetails.map(a => `  • ${a.orderCode}: $${a.amount.toFixed(2)} (${a.method})`),
                    `🧾 ماوە بۆ کۆمپانیا: $${remainingDue.toFixed(2)}`,
                  ] : []),
                  `─────────────`,
                  `تێبینی: کرێی گەیاندن لە کۆمپانیاوە دەدرێت و لەسەر کەستمەر دانانرێت.`,
                ].join('\n'),
                createdById: ctx.user.id,
              });

              // Link advance payment transactions (CREDIT_PAYMENT) to this invoice
              for (const txnId of advanceTxnIds) {
                try {
                  await db.linkTransactionToInvoice(txnId, invoice.id);
                } catch (e) {
                  appLogger.error("[Delivery FP] Failed to link advance txn to invoice", {
                    txnId, invoiceId: invoice.id, error: e instanceof Error ? e.message : String(e),
                  });
                }
              }

              for (const { order, chargeAmount, shippingShare } of fpItems) {
                try {
                  const txn = await db.applyChargeToInvoice(
                    customerId, customer.customerCode, 'FULL_PACKAGE',
                    order.id, chargeAmount,
                    `فول پاکێج ${order.orderCode} - ${order.productName} - گەیاندن`,
                    ctx.user.id, invoice.id,
                  );
                  await db.updateFullPackageOrder(order.id, {
                    status: 'delivered',
                    shippingCostUsd: shippingShare.toFixed(2),
                    deliveredDate: new Date(),
                    isCharged: true,
                    isChargedToCustomer: true,
                    chargedAt: new Date(),
                    chargeTransactionId: txn.id,
                    paidFromBalanceUsd: chargeAmount.toFixed(2),
                    batchId: id,
                  }, ctx.user.id);
                  appLogger.info("[Delivery FP] Charged and linked to consolidated invoice", {
                    customerCode: customer.customerCode, orderCode: order.orderCode, chargeAmount, invoiceNumber,
                  });
                } catch (e) {
                  appLogger.error("[Delivery FP] Failed to record charge for order", {
                    orderCode: order.orderCode, error: e instanceof Error ? e.message : String(e),
                  });
                }
              }
            } catch (e) {
              appLogger.error("[Delivery FP] Failed to create consolidated FP invoice for customer", {
                customerId, error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          // --- 2B. ONE INVOICE per customer for all Commission orders (item + commission + shipping combined)
          for (const [customerId, cmItems] of Array.from(commissionOrdersByCustomer.entries())) {
            try {
              const customer = await db.getCustomerById(customerId);
              if (!customer) continue;

              const lineItems: { description: string; quantity: number; unitPrice: number; total: number }[] = [];
              let totalAmount = 0;

              for (const { order, shippingShare } of cmItems) {
                const itemPrice = parseFloat(((order as any).itemPriceUsd || '0').toString()) || 0;
                const commissionFee = parseFloat(((order as any).commissionFeeUsd || '0').toString()) || 0;
                const qty = order.quantity || 1;
                const itemSubtotal = itemPrice * qty;

                // Line 1: Product with all context
                const productParts: string[] = [`🛍️ ${order.productName}`];
                productParts.push(`کۆدی ئۆردەر: ${order.orderCode}`);
                if (order.color) productParts.push(`ڕەنگ: ${order.color}`);
                if (order.size) productParts.push(`قەبارە: ${order.size}`);
                if (order.trackingNumber) productParts.push(`تراکینگ: ${order.trackingNumber}`);
                productParts.push(`${qty} × $${itemPrice.toFixed(2)} = $${itemSubtotal.toFixed(2)}`);
                if (itemSubtotal > 0) {
                  lineItems.push({
                    description: productParts.join('\n'),
                    quantity: qty, unitPrice: itemPrice, total: itemSubtotal,
                  });
                  totalAmount += itemSubtotal;
                }

                // Line 2: Commission (flat)
                if (commissionFee > 0) {
                  lineItems.push({
                    description: `💼 عمولەی کڕین — ${order.orderCode}\nفلاتە | Flat commission per order`,
                    quantity: 1, unitPrice: commissionFee, total: commissionFee,
                  });
                  totalAmount += commissionFee;
                }

                // Line 3: Shipping (split share)
                if (shippingShare > 0) {
                  lineItems.push({
                    description: `🚚 کرێی گواستنەوە — ${order.orderCode}\nدابەشکراو بەپێی کێش/CBM`,
                    quantity: 1, unitPrice: shippingShare, total: shippingShare,
                  });
                  totalAmount += shippingShare;
                }
              }

              if (totalAmount <= 0) continue;

              // Sum advance payments across all orders in this commission invoice
              let totalAdvancePaid = 0;
              const advanceTxnIds: number[] = [];
              const advanceDetails: { orderCode: string; amount: number; method: string }[] = [];
              for (const { order } of cmItems) {
                const adv = parseFloat(((order as any).advancePaidUsd || '0').toString()) || 0;
                if (adv > 0) {
                  totalAdvancePaid += adv;
                  if ((order as any).advancePaymentTransactionId) {
                    advanceTxnIds.push((order as any).advancePaymentTransactionId);
                  }
                  advanceDetails.push({
                    orderCode: order.orderCode,
                    amount: adv,
                    method: (order as any).advancePaymentMethod || 'CASH',
                  });
                }
              }
              const remainingDue = Math.max(0, totalAmount - totalAdvancePaid);
              const invoiceStatus: 'issued' | 'partially_paid' | 'paid' =
                totalAdvancePaid <= 0 ? 'issued'
                  : totalAdvancePaid >= totalAmount ? 'paid'
                    : 'partially_paid';

              const typeLabel = isSea ? 'دەریایی' : (batch?.shippingType === 'air_irregular' ? 'ئاسمانی نائاسایی' : 'ئاسمانی ئاسایی');
              const invoiceNumber = `INV-CM-${batch?.batchCode || 'B'}-${customer.customerCode}-${Date.now()}`;
              const invoice = await db.createInvoice({
                invoiceNumber,
                customerId,
                batchId: id,
                subtotalUsd: totalAmount.toFixed(2),
                totalUsd: totalAmount.toFixed(2),
                status: invoiceStatus,
                issuedAt: new Date(),
                paidAt: invoiceStatus === 'paid' ? new Date() : null,
                lineItems,
                notes: [
                  `🛍️ پسووڵەی گەیاندنی کڕین بە عمولە`,
                  `باچ: ${batch?.batchCode || ''} (${typeLabel})`,
                  `ژمارەی ئۆردەر: ${cmItems.length}`,
                  `کۆی کاڵا + عمولە + شیپینگ: $${totalAmount.toFixed(2)}`,
                  ...(totalAdvancePaid > 0 ? [
                    `─────────────`,
                    `💰 پارەی پێشەکی دراو: $${totalAdvancePaid.toFixed(2)}`,
                    ...advanceDetails.map(a => `  • ${a.orderCode}: $${a.amount.toFixed(2)} (${a.method})`),
                    `🧾 ماوە بۆ کۆمپانیا: $${remainingDue.toFixed(2)}`,
                  ] : []),
                ].join('\n'),
                createdById: ctx.user.id,
              });

              // Link advance payment transactions (CREDIT_PAYMENT) to this invoice
              for (const txnId of advanceTxnIds) {
                try {
                  await db.linkTransactionToInvoice(txnId, invoice.id);
                } catch (e) {
                  appLogger.error("[Delivery CM] Failed to link advance txn to invoice", {
                    txnId, invoiceId: invoice.id, error: e instanceof Error ? e.message : String(e),
                  });
                }
              }

              for (const { order, chargeAmount, shippingShare } of cmItems) {
                try {
                  // Main DEBIT: item + commission
                  const mainTxn = await db.applyChargeToInvoice(
                    customerId, customer.customerCode, 'COMMISSION',
                    order.id, chargeAmount,
                    `کڕین بە عمولە ${order.orderCode} - ${order.productName} (کاڵا + عمولە)`,
                    ctx.user.id, invoice.id,
                  );

                  // Separate DEBIT for shipping (linked to same invoice)
                  if (shippingShare > 0) {
                    await db.applyChargeToInvoice(
                      customerId, customer.customerCode, 'PACKAGE',
                      order.id, shippingShare,
                      `کڕین بە عمولە ${order.orderCode} - کرێی گواستنەوە`,
                      ctx.user.id, invoice.id,
                    );
                  }

                  const grossProfit = parseFloat(order.grossProfitUsd || '0');
                  const netProfitUsd = (grossProfit - shippingShare).toFixed(2);

                  await db.updateFullPackageOrder(order.id, {
                    status: 'delivered',
                    shippingCostUsd: shippingShare.toFixed(2),
                    deliveredDate: new Date(),
                    isCharged: true,
                    isChargedToCustomer: true,
                    chargedAt: new Date(),
                    chargeTransactionId: mainTxn.id,
                    paidFromBalanceUsd: chargeAmount.toFixed(2),
                    isShippingCharged: shippingShare > 0,
                    shippingChargedAt: shippingShare > 0 ? new Date() : null,
                    shippingChargedUsd: shippingShare.toFixed(2),
                    netProfitUsd,
                    batchId: id,
                  }, ctx.user.id);

                  appLogger.info("[Delivery CM] Charged and linked to consolidated invoice", {
                    customerCode: customer.customerCode, orderCode: order.orderCode,
                    chargeAmount, shippingShare, invoiceNumber,
                  });
                } catch (e) {
                  appLogger.error("[Delivery CM] Failed to record charges for order", {
                    orderCode: order.orderCode, error: e instanceof Error ? e.message : String(e),
                  });
                }
              }
            } catch (e) {
              appLogger.error("[Delivery CM] Failed to create consolidated CM invoice for customer", {
                customerId, error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          // --- 2C. ONE INVOICE per customer for all normal packages (existing logic preserved)
          for (const [customerId, customerPackages] of Array.from(packagesByCustomer.entries())) {
            try {
              // STEP 1: Separate uncharged packages from already-charged ones
              const unchargedPackages: typeof customerPackages = [];
              for (const pkg of customerPackages) {
                const freshPkg = await db.getPackageById(pkg.id);
                if (freshPkg?.isCharged) {
                  appLogger.info("[Batch] Package already charged, skipping invoice+charge", { packageCode: pkg.packageCode });
                } else {
                  unchargedPackages.push(pkg);
                }
              }

              // If ALL packages were already charged, skip invoice creation entirely
              if (unchargedPackages.length === 0) {
                appLogger.info("[Batch] All packages for customer already charged, no new invoice needed", { customerId, totalPkgs: customerPackages.length });
                continue;
              }

              // STEP 2: Calculate total ONLY for uncharged packages
              //
              // The invoice lineItems used to say only "پاکەت TRK-xxx - 5.5 KG × $2.5"
              // which didn't let the customer reconcile: they couldn't see actual vs
              // volumetric weight, dimensions, or CTN count. We now build a rich
              // multi-line description per package so every billable data point is
              // visible both in the admin PDF and on the portal.
              let totalAmount = 0;
              let totalWeight = 0;
              let totalCbm = 0;
              const lineItems = [];

              for (const pkg of unchargedPackages) {
                let pkgPrice = 0;
                let quantity = 0;
                let unit = 'KG';

                // Raw package measurements — used both in the charge math and in the
                // invoice description so the customer can verify the numbers.
                const actualKg = parseFloat(pkg.weightKg?.toString() || "0");
                const lengthCm = parseFloat(pkg.lengthCm?.toString() || "0");
                const widthCm = parseFloat(pkg.widthCm?.toString() || "0");
                const heightCm = parseFloat(pkg.heightCm?.toString() || "0");
                const cbm = parseFloat(pkg.volumeCbm?.toString() || "0");
                const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                const chargeableKg = Math.max(actualKg, volumetricKg);
                const cartonCount = (pkg as any).cartonCount ?? 1;

                if (isSea && pricePerCbm > 0) {
                  pkgPrice = cbm * pricePerCbm;
                  quantity = cbm;
                  unit = 'CBM';
                } else if (pricePerKg > 0) {
                  pkgPrice = chargeableKg * pricePerKg;
                  quantity = chargeableKg;
                  unit = 'KG';
                }

                if (pkgPrice > 0) {
                  await db.updatePackage(pkg.id, {
                    calculatedCostUsd: pkgPrice.toFixed(2)
                  });
                }

                totalAmount += pkgPrice;
                totalWeight += actualKg;
                totalCbm += cbm;

                // Rich multi-line description. `\n` renders as <br/> in the invoice
                // template and as a line break in the portal card — both call sites
                // wrap with `white-space: pre-line`.
                const descParts: string[] = [];
                const trackingLabel = pkg.trackingNumber
                  ? `📦 ${pkg.trackingNumber}`
                  : `📦 ${pkg.packageCode}`;
                descParts.push(trackingLabel);
                if (pkg.trackingNumber && pkg.packageCode) {
                  descParts.push(`کۆد: ${pkg.packageCode}`);
                }
                if ((pkg as any).productDescription) {
                  descParts.push(`ناوەرۆک: ${(pkg as any).productDescription}`);
                }

                // Measurements line — tailored to shipping type so we don't show
                // irrelevant data (e.g. volumetric weight for sea freight).
                if (isSea) {
                  const measureParts = [`CBM: ${cbm.toFixed(3)} m³`];
                  if (actualKg > 0) measureParts.push(`کێش: ${actualKg.toFixed(2)} kg`);
                  if (lengthCm > 0) measureParts.push(`${lengthCm}×${widthCm}×${heightCm} cm`);
                  if (cartonCount > 1) measureParts.push(`CTN: ${cartonCount}`);
                  descParts.push(measureParts.join(' · '));
                  descParts.push(`نرخ: ${cbm.toFixed(3)} m³ × $${pricePerCbm.toFixed(2)}/m³ = $${pkgPrice.toFixed(2)}`);
                } else {
                  const measureParts: string[] = [];
                  if (actualKg > 0) measureParts.push(`کێشی ڕاستەقینە: ${actualKg.toFixed(2)} kg`);
                  if (volumetricKg > 0) measureParts.push(`کێشی قەبارەیی: ${volumetricKg.toFixed(2)} kg`);
                  if (lengthCm > 0) measureParts.push(`${lengthCm}×${widthCm}×${heightCm} cm`);
                  if (cartonCount > 1) measureParts.push(`CTN: ${cartonCount}`);
                  if (measureParts.length) descParts.push(measureParts.join(' · '));
                  // Always show which weight was used for billing so the customer
                  // understands the higher-of rule without having to ask.
                  descParts.push(
                    `نرخ: ${chargeableKg.toFixed(2)} kg (${chargeableKg === volumetricKg && volumetricKg > actualKg ? 'قەبارەیی' : 'ڕاستەقینە'}) × $${pricePerKg.toFixed(2)}/kg = $${pkgPrice.toFixed(2)}`
                  );
                }

                lineItems.push({
                  description: descParts.join('\n'),
                  quantity: 1,
                  unitPrice: pkgPrice,
                  total: pkgPrice,
                });
              }

              if (totalAmount > 0) {
                // STEP 3: Create ONE consolidated invoice ONLY for uncharged packages
                const invoiceNumber = `INV-${Date.now()}-${customerId}`;
                // Richer notes field — the portal already shows `notes` above the
                // table, so give customers a quick batch summary they can scan
                // before diving into per-package rows.
                const notesParts: string[] = [];
                notesParts.push(`پسووڵەی باچ ${batch?.batchCode || ''}`);
                if (batch?.shippingType) {
                  const typeLabel = batch.shippingType === 'sea' ? 'دەریایی'
                    : batch.shippingType === 'air_irregular' ? 'ئاسمانی نائاسایی'
                    : 'ئاسمانی ئاسایی';
                  notesParts.push(`جۆری گواستنەوە: ${typeLabel}`);
                }
                notesParts.push(`ژمارەی پاکەت: ${unchargedPackages.length}`);
                if (totalWeight > 0) notesParts.push(`کۆی کێش: ${totalWeight.toFixed(2)} kg`);
                if (totalCbm > 0) notesParts.push(`کۆی قەبارە: ${totalCbm.toFixed(3)} m³`);
                if (isSea && pricePerCbm > 0) notesParts.push(`نرخی m³: $${pricePerCbm.toFixed(2)}`);
                if (!isSea && pricePerKg > 0) notesParts.push(`نرخی kg: $${pricePerKg.toFixed(2)}`);
                notesParts.push(`کۆی گشتی: $${totalAmount.toFixed(2)}`);
                // Tracking-number list at the end so customers can ctrl-F match
                // their external tracking references without scrolling through
                // every line item.
                const trackingList = unchargedPackages
                  .map(p => p.trackingNumber || p.packageCode)
                  .filter(Boolean)
                  .join(', ');
                if (trackingList) notesParts.push(`تراکینگ نەمبەرەکان: ${trackingList}`);

                const invoice = await db.createInvoice({
                  invoiceNumber,
                  customerId,
                  batchId: id,
                  subtotalUsd: totalAmount.toFixed(2),
                  totalUsd: totalAmount.toFixed(2),
                  status: "issued",
                  issuedAt: new Date(),
                  lineItems: lineItems as { description: string; quantity: number; unitPrice: number; total: number; }[],
                  notes: notesParts.join('\n'),
                  createdById: ctx.user.id,
                });

                // STEP 4: Record charge for each uncharged package and link to consolidated invoice
                const customer = await db.getCustomerById(customerId);
                if (customer) {
                  for (const pkg of unchargedPackages) {
                    let pkgPrice = 0;
                    if (isSea && pricePerCbm > 0) {
                      const cbm = parseFloat(pkg.volumeCbm?.toString() || "0");
                      pkgPrice = cbm * pricePerCbm;
                    } else if (pricePerKg > 0) {
                      // Use chargeable weight (max of actual and volumetric)
                      const actualKg = parseFloat(pkg.weightKg?.toString() || "0");
                      const lengthCm = parseFloat(pkg.lengthCm?.toString() || "0");
                      const widthCm = parseFloat(pkg.widthCm?.toString() || "0");
                      const heightCm = parseFloat(pkg.heightCm?.toString() || "0");
                      const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                      const chargeableKg = Math.max(actualKg, volumetricKg);
                      pkgPrice = chargeableKg * pricePerKg;
                    }

                    if (pkgPrice > 0) {
                      // Use recordPackageChargeWithoutInvoice to avoid creating duplicate invoices
                      await db.recordPackageChargeWithoutInvoice(
                        customerId,
                        customer.customerCode,
                        pkg.id,
                        pkgPrice,
                        `پاکەت ${pkg.trackingNumber || pkg.packageCode} - باچ ${batch?.batchCode || ''}`,
                        ctx.user.id,
                        invoice.id  // Link to the consolidated invoice
                      );

                      // Mark package as charged to prevent future double charging
                      await db.updatePackage(pkg.id, { isCharged: true });

                      // Create revenue record (correct charge point)
                      try {
                        await db.createRevenueRecord({
                          recordDate: new Date(),
                          revenueType: 'package_delivery',
                          referenceType: 'package',
                          referenceId: pkg.id,
                          customerId,
                          amountUsd: pkgPrice,
                          description: `Package delivery - ${pkg.packageCode}`,
                          createdById: ctx.user.id,
                        });
                      } catch (e) {
                        appLogger.error("[Finance] Failed to create revenue record for package delivery", { packageId: pkg.id, error: e instanceof Error ? e.message : String(e) });
                      }
                    }
                  }
                }
              }
            } catch (e) {
              appLogger.error("[Invoice] Failed to create invoice for customer", { customerId, error: e instanceof Error ? e.message : String(e) });
            }
          }
          
          // Notify customers about delivery
          try {
            await notifyBatchStatusChange(id, "batch_arrived"); // Use arrived notification for now
          } catch (e) {
            appLogger.error("[Notification] Failed to send batch delivery notification", { error: e instanceof Error ? e.message : String(e) });
          }
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_batch_status",
          entityType: "batch",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        batchCode: z.string().optional(),
        carrierInfo: z.string().optional(),
        // Detailed shipping info
        airlineName: z.string().optional(),
        flightNumber: z.string().optional(),
        shippingCompany: z.string().optional(),
        containerNumber: z.string().optional(),
        vesselName: z.string().optional(),
        shippingCost: z.string().optional(),
        departureDate: z.date().optional(),
        estimatedArrival: z.date().optional(),
        // Actual measurements
        actualWeightKg: z.string().optional(),
        actualCbm: z.string().optional(),
        // Charged measurements (what we pay)
        chargedWeightKg: z.string().optional(),
        chargedCbm: z.string().optional(),
        // Cost fields (our cost)
        costPerKg: z.string().optional(),
        costPerCbm: z.string().optional(),
        // Selling price fields
        pricePerKg: z.string().optional(),
        pricePerCbm: z.string().optional(),
        // Tiered pricing
        useTieredPricing: z.boolean().optional(),
        pricingTiers: z.array(z.object({
          minValue: z.string(),
          maxValue: z.string().nullable(),
          pricePerUnit: z.string(),
        })).optional(),
        // Customer-specific pricing
        customerPricing: z.array(z.object({
          customerId: z.number(),
          pricePerKg: z.string().optional(),
          pricePerCbm: z.string().optional(),
          notes: z.string().optional(),
        })).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, pricingTiers, customerPricing, ...data } = input;
        await db.updateBatch(id, data);
        
        // Update pricing tiers if provided
        if (pricingTiers !== undefined) {
          await db.setBatchPricingTiers(id, pricingTiers.map((tier, index) => ({
            minValue: tier.minValue,
            maxValue: tier.maxValue,
            pricePerUnit: tier.pricePerUnit,
            sortOrder: index,
          })));
        }
        
        // Update customer-specific pricing if provided
        if (customerPricing !== undefined) {
          await db.setBatchCustomerPricing(id, customerPricing.map(cp => ({
            customerId: cp.customerId,
            pricePerKg: cp.pricePerKg,
            pricePerCbm: cp.pricePerCbm,
            notes: cp.notes,
            createdById: ctx.user.id,
          })));
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_batch",
          entityType: "batch",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    // Get batches filtered by shipping type
    getByShippingType: staffProcedure
      .input(z.object({ shippingType: z.enum(["air_regular", "air_irregular", "sea"]) }))
      .query(async ({ input }) => {
        return db.getBatchesByShippingType(input.shippingType);
      }),
    
    // Get pricing tiers for a batch
    getPricingTiers: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        return db.getBatchPricingTiers(input.batchId);
      }),
    
    // Get customer-specific pricing for a batch
    getCustomerPricing: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        const pricing = await db.getBatchCustomerPricing(input.batchId);
        // Get customer details for each pricing entry
        const customers = await db.getAllCustomers();
        const customerMap = new Map(customers.map(c => [c.id, c]));
        return pricing.map(p => ({
          ...p,
          customer: customerMap.get(p.customerId),
        }));
      }),
    
    // List all customer-specific pricing across all batches (paginated batch fetch)
    listAllCustomerPricing: staffProcedure
      .input(z.object({ page: z.number().min(1).optional(), pageSize: z.number().min(1).max(100).optional() }).optional())
      .query(async ({ input }) => {
        const result = await db.getAllBatches({ page: input?.page, pageSize: input?.pageSize ?? 50 });
        const batchIds = result.data.map((b) => b.id);
        if (batchIds.length === 0) return { data: [], total: 0, page: result.page, pageSize: result.pageSize, totalPages: 0 };
        const pricingByBatch = await db.getBatchCustomerPricingForBatches(batchIds);
        const allPricing: { batchId: number; customerId: number; pricePerKg?: string; pricePerCbm?: string }[] = [];
        for (const batchId of batchIds) {
          const pricing = pricingByBatch.get(batchId) ?? [];
          for (const p of pricing) {
            allPricing.push({ batchId, ...p });
          }
        }
        return { data: allPricing, total: allPricing.length, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages };
      }),
    
    // Get financial summary for a batch
    getFinancialSummary: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        return db.getBatchFinancialSummary(input.batchId);
      }),
    
    // Get customer packages in a batch with Full Package detection
    getCustomerPackages: staffProcedure
      .input(z.object({ batchId: z.number(), customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerPackagesInBatch(input.customerId, input.batchId);
      }),
    
    // Generate PDF report for batch financial summary
    generateFinancialPDF: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .mutation(async ({ input }) => {
        const { generateBatchFinancialPDF } = await import("../services/pdf.service");
        const batch = await db.getBatchById(input.batchId);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
        
        const summary = await db.getBatchFinancialSummary(input.batchId);
        if (!summary) throw new TRPCError({ code: "NOT_FOUND", message: "Financial summary not found" });
        
        const customers = await db.getAllCustomers();
        const customerMap = new Map(customers.map(c => [c.id, c]));
        
        const pdfUrl = await generateBatchFinancialPDF({
          batchCode: batch.batchCode,
          shippingType: batch.shippingType,
          status: batch.status,
          departureDate: batch.departureDate ? new Date(batch.departureDate).toLocaleDateString() : undefined,
          arrivalDate: batch.actualArrival ? new Date(batch.actualArrival).toLocaleDateString() : undefined,
          actualVolume: summary.shippingType === 'sea' ? summary.actualCbm : summary.actualWeight,
          chargedVolume: summary.shippingType === 'sea' ? summary.chargedCbm : summary.chargedWeight,
          costPerUnit: summary.shippingType === 'sea' ? summary.costPerCbm : summary.costPerKg,
          totalCost: summary.totalCost,
          totalRevenue: summary.totalRevenue,
          profit: summary.profit,
          profitMargin: summary.profitMargin,
          customerBreakdown: summary.customerBreakdown.map(cb => {
            const customer = customerMap.get(cb.customerId);
            return {
              customerName: customer?.fullName || 'Unknown',
              customerCode: customer?.customerCode || 'N/A',
              packages: cb.packages,
              volume: summary.shippingType === 'sea' ? cb.cbm : cb.weight,
              revenue: cb.revenue,
            };
          }),
        });
        
        return { url: pdfUrl };
      }),
    
    // Calculate price for a customer in a batch
    calculateCustomerPrice: staffProcedure
      .input(z.object({
        batchId: z.number(),
        customerId: z.number(),
      }))
      .query(async ({ input }) => {
        const batch = await db.getBatchById(input.batchId);
        if (!batch) return null;
        
        const unit = batch.shippingType === 'sea' ? 'cbm' : 'kg';
        const customerTotal = await db.getCustomerTotalInBatch(input.batchId, input.customerId, unit);
        
        // Check if batch uses tiered pricing
        if (batch.useTieredPricing) {
          const tierPrice = await db.getApplicableTierPrice(input.batchId, customerTotal);
          if (tierPrice !== null) {
            return {
              customerTotal,
              unit,
              pricePerUnit: tierPrice,
              totalPrice: customerTotal * tierPrice,
              isTiered: true,
            };
          }
        }
        
        // Use default price
        const defaultPrice = unit === 'cbm' 
          ? Number(batch.pricePerCbm) || 0 
          : Number(batch.pricePerKg) || 0;
        
        return {
          customerTotal,
          unit,
          pricePerUnit: defaultPrice,
          totalPrice: customerTotal * defaultPrice,
          isTiered: false,
        };
      }),
});

