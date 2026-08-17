import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as bcrypt from "bcryptjs";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { staffProcedure, adminProcedure, accountantProcedure, customerProcedure } from "../middleware/auth";
import * as db from "../db";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";
import { buildBatchInvoice } from "@shared/batchInvoice";
import { getVapidPublicKey, isPushEnabled, sendPushToCustomer } from "../services/push.service";
import { toCustomerVisibleOrder, toCustomerVisibleOrders } from "../lib/customerVisibleOrder";
import { isSafeAvatar, isSafeCustomerImage, MAX_CUSTOMER_IMAGES } from "@shared/customerImages";

/**
 * Photos a customer attaches, checked before they are stored.
 *
 * These end up rendered on a staff review screen, so the endpoint has to agree
 * with the upload widget rather than trust it — see @shared/customerImages.
 */
const customerImagesSchema = z
  .array(z.string().refine(isSafeCustomerImage, "Unsupported image"))
  .max(MAX_CUSTOMER_IMAGES);

// Best-effort portal-activity capture for the admin Customer Portal Center.
// Fire-and-forget: logging never blocks or fails the customer's real action.
type PortalCategory = "auth" | "navigation" | "declaration" | "claim" | "message" | "search" | "profile" | "other";
function logPortal(
  ctx: any,
  customerId: number,
  action: string,
  category: PortalCategory,
  extra?: { detail?: string | null; entityType?: string; entityId?: number; path?: string },
) {
  void db.logCustomerActivity({
    customerId,
    action,
    category,
    detail: extra?.detail ? String(extra.detail).slice(0, 500) : null,
    entityType: extra?.entityType ?? null,
    entityId: extra?.entityId ?? null,
    path: extra?.path ? extra.path.slice(0, 255) : null,
    ipAddress: (ctx.req?.ip || "").slice(0, 64) || null,
    userAgent: (ctx.req?.headers?.["user-agent"] || "").slice(0, 400) || null,
  });
}

export const customerPortalRouter = router({
    // Not customerProcedure: this is the endpoint that reports whether there
    // is a customer profile at all, so it has to be able to answer "no".
    getMyAccount: protectedProcedure.query(async ({ ctx }) => {
      // For merged model, the user IS the customer if isCustomer is true
      if (ctx.user.isCustomer) {
        const customer = ctx.user as Record<string, unknown>;
        return {
          id: customer.id as number,
          customerCode: (customer.customerCode as string) || '',
          fullName: (customer.fullName as string) || (customer.name as string) || '',
          mobileNumber: (customer.mobileNumber as string) || '',
          email: (customer.email as string) || '',
          country: (customer.country as string) || '',
          city: (customer.city as string) || '',
          address: (customer.address as string) || '',
          photoUrl: (customer.photoUrl as string) || null,
        };
      }
      // Legacy: find customer linked to this user. Hand-picked to the same
      // eight fields as the branch above — `return customer` shipped the whole
      // row, which carries passwordHash, passportUrl, nationalIdUrl and the
      // staff-only notes column.
      const customer = await db.getCustomerByUserId(ctx.user.id);
      if (!customer) return null;
      return {
        id: customer.id,
        customerCode: customer.customerCode || '',
        fullName: customer.fullName || '',
        mobileNumber: customer.mobileNumber || '',
        email: customer.email || '',
        country: customer.country || '',
        city: customer.city || '',
        address: customer.address || '',
        photoUrl: customer.photoUrl || null,
      };
    }),

    // ============ SECURITY ============
    // Customer changes their own portal password. Verifies the current
    // password against the stored bcrypt hash, then stores a fresh hash.
    changeMyPassword: customerProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        const customer = await db.getCustomerById(customerId);
        if (!customer || !customer.passwordHash) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'ناتوانرێت وشەی نهێنی بگۆڕدرێت بۆ ئەم هەژمارە.' });
        }

        const isValid = await bcrypt.compare(input.currentPassword, customer.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'وشەی نهێنی ئێستا هەڵەیە.' });
        }

        const newHash = await bcrypt.hash(input.newPassword, 12);
        await db.updateCustomerPassword(customerId, newHash, { changedByCustomer: true });
        logPortal(ctx, customerId, "change_password", "profile");
        return { success: true };
      }),

    /**
     * The customer's own profile photo.
     *
     * Theirs to set and theirs to remove — nothing else about the account is
     * editable from the portal, so this is deliberately narrow: one column,
     * checked against the same allow-list as every other image a customer
     * sends us, and nothing about who they are can be changed through it.
     */
    setMyPhoto: customerProcedure
      .input(z.object({
        photo: z.string().refine(isSafeAvatar, "Unsupported image"),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        await db.updateCustomerPhoto(customerId, input.photo);
        logPortal(ctx, customerId, "set_photo", "profile");
        return { success: true };
      }),

    removeMyPhoto: customerProcedure.mutation(async ({ ctx }) => {
      const customerId = ctx.customerId;
      // Cleared, not blanked: an empty string would read as a photo we
      // could not display rather than as no photo at all.
      await db.updateCustomerPhoto(customerId, null);
      logPortal(ctx, customerId, "remove_photo", "profile");
      return { success: true };
    }),

    /**
     * The customer's own delivery boxes — the goods packed for them
     * specifically, as opposed to the batch they travelled in.
     */
    getMyDeliveryBoxes: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getCustomerVisibleBoxes(customerId);
    }),

    /**
     * The photo and signature taken when a box was handed over.
     *
     * Scoped by customerId inside the query itself, not checked after: a box
     * id is guessable, and this is the one endpoint that returns a picture of
     * somebody's front door.
     */
    getMyBoxProof: customerProcedure
      .input(z.object({ boxId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        return db.getCustomerBoxProof(input.boxId, customerId);
      }),

    /**
     * "I have received it." Confirms one of the customer's own boxes.
     *
     * One direction only: there is no way back from here. If it was tapped by
     * mistake a member of staff can undo it, but a customer cannot quietly
     * reverse a receipt they have already given.
     */
    confirmBoxReceived: customerProcedure
      .input(z.object({ boxId: z.number().int() }))
      .mutation(async ({ input, ctx }) => {
        const customerId = ctx.customerId;
        const box = await db.getDeliveryBoxById(input.boxId);
        const result = await db.confirmBoxReceivedByCustomer(input.boxId, customerId);

        // Put it on the office's activity feed. A box closing itself without a
        // staff member touching it is exactly the kind of movement the office
        // should be able to see — and the feed is where it belongs rather than
        // a push per box, which would be noise within a week.
        if (result.ok && box) {
          logPortal(ctx, customerId, "confirm_box_received", "claim", {
            detail: box.boxCode,
            entityType: "deliveryBox",
            entityId: box.id,
          });
          try {
            const customer = await db.getCustomerById(customerId);
            await db.createActivityAlert({
              action: "customer_confirmed_delivery",
              category: "package",
              entityType: "deliveryBox",
              entityId: box.id,
              entityCode: box.boxCode,
              triggeredById: customerId,
              triggeredByName: customer?.fullName || customer?.customerCode || "کڕیار",
              customTitle: "کڕیار وەرگرتنی دووپات کردەوە",
              customMessage:
                `${customer?.fullName || "کڕیار"}${customer?.customerCode ? ` (${customer.customerCode})` : ""}` +
                ` لە پۆرتاڵەوە دووپاتی کردەوە کە بۆکسی ${box.boxCode} بەدەستی گەیشتووە.`,
              severity: "info",
            });
          } catch {
            // The confirmation itself already succeeded; a failed feed entry
            // must not turn that into an error for the customer.
          }
        }

        if (!result.ok) {
          const messages: Record<string, string> = {
            not_found: "بۆکس نەدۆزرایەوە",
            not_yours: "ئەم بۆکسە هی تۆ نییە",
            not_sent_yet: "ئەم بۆکسە هێشتا نەنێردراوە",
          };
          throw new TRPCError({
            code: result.reason === "not_yours" ? "FORBIDDEN" : "BAD_REQUEST",
            message: messages[result.reason ?? ""] ?? "نەتوانرا دووپات بکرێتەوە",
          });
        }
        return { success: true };
      }),

    getMyPackages: customerProcedure.query(async ({ ctx }) => {
      // Column-listed and capped: the old call returned every column of every
      // row, including the delivery signature and photo — canvas data URIs
      // written from uncapped strings — and the staff-only notes and QR
      // signature. On a long-standing account it was large enough to time out
      // on a mobile connection, and it grew every month.
      const customerId = ctx.customerId;
      return db.getCustomerVisiblePackages(customerId);
    }),
    getMyInvoices: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      const result = await db.getInvoicesByCustomer(customerId, { limit: 50, page: 1 });
      return result.data;
    }),
    getMyBalance: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.isCustomer) {
        return db.getCustomerBalance(ctx.user.id);
      }
      const customer = await db.getCustomerByUserId(ctx.user.id);
      if (!customer) return 0;
      return db.getCustomerBalance(customer.id);
    }),
    
    // Get customer's batches with their package count
    getMyBatches: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getCustomerBatches(customerId);
    }),
    
    // Get customer's packages in a specific batch
    getMyPackagesInBatch: customerProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        return db.getCustomerPackagesInBatch(customerId, input.batchId);
      }),
    
    /**
     * One batch, itemised.
     *
     * The customer gets four parcels and one figure, and the question they
     * actually ask — what did each of these cost me, and why that much for
     * carriage — has never had an answer on any screen. It arrives by
     * WhatsApp instead and somebody works it out by hand.
     *
     * Scoped to ctx.customerId, never to an id from the request: a batch
     * holds many customers' parcels, and reading the batch id from the
     * caller while trusting it for ownership is how one customer is handed
     * another's invoice.
     */
    getMyBatchInvoice: customerProcedure
      .input(z.object({ batchId: idSchema }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        const batch = await db.getBatchById(input.batchId);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "باچ نەدۆزرایەوە" });

        const orders = await db.getCustomerOrdersInBatch(input.batchId, customerId);
        if (orders.length === 0) {
          // Nothing of theirs is in it. Said as not-found rather than as an
          // empty invoice, so a guessed batch id reveals nothing about
          // whether that batch exists at all.
          throw new TRPCError({ code: "NOT_FOUND", message: "باچ نەدۆزرایەوە" });
        }

        return {
          batch: {
            id: batch.id,
            batchCode: batch.batchCode,
            shippingType: batch.shippingType,
            status: batch.status,
            actualArrival: batch.actualArrival,
            createdAt: batch.createdAt,
          },
          invoice: buildBatchInvoice(orders, 0),
        };
      }),
    // Get unbatched packages
    getMyUnbatchedPackages: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getCustomerUnbatchedPackages(customerId);
    }),
    
    /**
     * Parcels the customer bought themselves — no order of ours behind them.
     *
     * Derived on every read from the same rule as the self-order revenue
     * report, never stored. A parcel leaves this list by itself the moment an
     * admin enters the purchase order that owns its tracking number.
     */
    getMySelfOrderPackages: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getSelfOrderPackagesByCustomer(customerId);
    }),

    // Get customer's full package orders (for customer portal)
    getMyFullPackageOrders: customerProcedure
      .input(z.object({
        orderType: z.enum(["full_package", "commission", "purchase_request"]).optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        // Every list row carried purchasePriceUsd / grossProfitUsd /
        // netProfitUsd and the supplier ids. This is the list the portal loads
        // on five different screens, so it was the widest of the leaks.
        const orders = await db.getFullPackageOrdersByCustomer(customerId, input);
        return toCustomerVisibleOrders(orders as any[]);
      }),

    /**
     * Customer-facing summary of pending (not-yet-delivered, uncharged) orders.
     * Powers the "Awaiting Delivery" card on the portal home — so customers
     * can see at a glance how many orders are still flowing through the
     * pipeline and what the estimated invoice total will be.
     */
    getMyPendingOrders: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      const raw = await db.getFullPackageOrdersByCustomer(customerId);
      const list = Array.isArray(raw) ? raw : ((raw as any)?.data ?? []);
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
        count: pending.length,
        totalPriceUsd: Math.round(totalPriceUsd * 100) / 100,
        oldestAt: oldestAt ? oldestAt.toISOString() : null,
        byType,
      };
    }),
    
    // Get financial summary
    getMyFinancialSummary: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getCustomerFinancialSummary(customerId);
    }),
    
    /**
     * Paid and charged per month, counted over the whole period.
     *
     * The page used to derive this in the browser from the fifty most recent
     * transactions, so an active customer's monthly total and six-month chart
     * were short by however much did not fit — beside a balance that was
     * right. See getCustomerMonthlyMoney.
     */
    getMyMonthlyMoney: customerProcedure
      .input(z.object({ months: z.number().int().min(1).max(24).default(6) }).optional())
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        return db.getCustomerMonthlyMoney(customerId, input?.months ?? 6);
      }),

    // Get transaction history
    getMyTransactions: customerProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        return db.getCustomerTransactionHistory(customerId, input?.limit || 50);
      }),
    
    // Search package by tracking number
    searchPackage: customerProcedure
      .input(z.object({ trackingNumber: z.string() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        logPortal(ctx, customerId, "search", "search", { detail: input.trackingNumber });
        const found = await db.searchCustomerPackage(customerId, input.trackingNumber);
        if (!found) return found;

        /**
         * Whether this parcel was registered at an origin depot.
         *
         * The journey it shows depends on it: registered in China it is
         * already in that warehouse, registered in Erbil it never goes there.
         * Null when the location was never recorded, which the portal reads
         * as China — everything predating the stamp went through that depot.
         */
        const originIds = await db.getOriginCountryIds();
        const countryId = (found as any).registeredInCountryId ?? null;
        return {
          ...found,
          registeredAtOrigin: countryId == null ? null : originIds.has(countryId),
        };
      }),

    // Same search box, but for full-package/commission orders: matches the
    // order number (FP-...) or the order's tracking number.
    searchOrder: customerProcedure
      .input(z.object({ query: z.string().trim().min(1).max(100) }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        return db.searchCustomerOrder(customerId, input.query);
      }),

    // Unified-search fallback: when a tracking isn't one of the customer's own
    // registered packages, tell them what else we know — is it sitting
    // unclaimed (claimable), or did they pre-declare it (awaiting arrival)?
    searchTrackingExtra: customerProcedure
      .input(z.object({ trackingNumber: z.string().trim().min(1) }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        const pkg = await db.getPackageByTrackingNumber(input.trackingNumber);
        const unclaimed = pkg && pkg.isUnclaimed ? pkg : null;
        const declared = await db.findCustomerDeclaredByTracking(customerId, input.trackingNumber);
        return { unclaimed, declared };
      }),

    // ============ DELIVERY RATING ============
    // The most recent delivered package (14 days) the customer hasn't rated.
    getRatablePackage: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getRatablePackage(customerId);
    }),

    submitDeliveryRating: customerProcedure
      .input(z.object({
        packageId: z.number(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg || pkg.customerId !== customerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        }
        const ok = await db.createDeliveryRating({
          customerId,
          packageId: input.packageId,
          rating: input.rating,
          comment: input.comment,
        });
        logPortal(ctx, customerId, "rate_delivery", "other", {
          detail: `${input.rating}/5${input.comment ? ` — ${input.comment.slice(0, 100)}` : ""}`,
          entityType: "package",
          entityId: input.packageId,
        });
        return { success: ok };
      }),

    // Portal navigation tracking — the portal layout calls this on route change
    // so the admin Portal Center can see which pages each customer visits.
    // Best-effort observability; returns quickly and never throws.
    trackActivity: customerProcedure
      .input(z.object({
        path: z.string().max(255),
        action: z.string().max(60).default("page_view"),
        detail: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        logPortal(ctx, customerId, input.action, "navigation", { path: input.path, detail: input.detail });
        return { ok: true };
      }),

    // Account statement PDF — the customer's own report, base64-encoded like
    // the staff exportCustomerPDF. Lazy import keeps pdfkit off the hot path.
    // Labels render in the customer's language (ku/ar via embedded font, zh
    // falls back to en); numbers/codes stay Latin. Optional date range and
    // charge/payment type filter.
    getMyStatementPdf: customerProcedure
      .input(z.object({
        language: z.enum(["ku", "en", "ar", "zh"]).default("en"),
        from: z.date().optional(),
        to: z.date().optional(),
        type: z.enum(["all", "charges", "payments"]).default("all"),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        const { getCustomerReportData, generateCustomerPDF } = await import("../services/pdf.service");
        const data = await getCustomerReportData(
          customerId,
          input?.from,
          input?.to,
          { txType: input?.type ?? "all" },
        );
        if (!data) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No account data found" });
        }
        const pdfBuffer = await generateCustomerPDF(data, input?.language ?? "en");
        logPortal(ctx, customerId, "statement_pdf", "other", { detail: "downloaded account statement" });
        return {
          pdf: pdfBuffer.toString("base64"),
          filename: `statement-${data.customer.customerCode || customerId}.pdf`,
        };
      }),

    // ---- Wazn News: social channels + ticker toggle (read-only) ----
    getNewsChannels: protectedProcedure.query(async () => {
      const s = await db.getWaznNewsSettings();
      return {
        tickerEnabled: s.tickerEnabled,
        youtube: s.youtube,
        telegram: s.telegram,
        tiktok: s.tiktok,
        instagram: s.instagram,
        facebook: s.facebook,
      };
    }),

    // ---- Yuan exchange (buy CNY with USD at the company's sell rate) ----
    getYuanExchangeInfo: protectedProcedure.query(async () => {
      const s = await db.getYuanExchangeSettings();
      return {
        enabled: s.enabled,
        rate: s.rate,
        minUsd: s.minUsd,
        maxUsd: s.maxUsd,
        noteKu: s.noteKu,
        noteEn: s.noteEn,
        noteAr: s.noteAr,
        noteZh: s.noteZh,
      };
    }),

    getMyYuanOrders: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getYuanOrdersByCustomer(customerId);
    }),

    createYuanOrder: customerProcedure
      .input(z.object({
        usdAmount: z.number().positive().max(1_000_000),
        note: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        const settings = await db.getYuanExchangeSettings();
        if (!settings.enabled) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Yuan exchange is currently unavailable" });
        }
        if (settings.minUsd != null && input.usdAmount < settings.minUsd) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Minimum amount is $${settings.minUsd}` });
        }
        if (settings.maxUsd != null && input.usdAmount > settings.maxUsd) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Maximum amount is $${settings.maxUsd}` });
        }
        // The rate is locked server-side at order time — never trusted from the client.
        const usd = Math.round(input.usdAmount * 100) / 100;
        const cny = Math.round(usd * settings.rate * 100) / 100;
        const order = await db.createYuanExchangeOrder({
          customerId,
          usdAmount: usd.toFixed(2),
          cnyAmount: cny.toFixed(2),
          rate: String(settings.rate),
          customerNote: input.note?.trim() ? input.note.trim().slice(0, 1000) : null,
        });
        if (!order) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save the order" });
        }
        logPortal(ctx, customerId, "yuan_order", "other", {
          detail: `$${usd} -> ¥${cny} @ ${settings.rate}`,
          entityType: "yuan_exchange_order",
          entityId: order.id,
        });
        return order;
      }),

    // Get notification count
    getNotificationCount: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getCustomerNotificationCount(customerId);
    }),
    
    // Generate PDF receipt for a transaction
    getReceiptData: customerProcedure
      .input(z.object({ transactionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        
        // Get customer account to verify ownership
        const account = await db.getCustomerAccountByCustomerId(customerId);
        if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
        
        const transaction = await db.getLedgerTransactionById(input.transactionId);
        if (!transaction || transaction.accountId !== account.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
        }
        
        const customer = await db.getCustomerById(customerId);
        
        const ctxCustomer = ctx.user as any;
        return {
          transaction,
          customer: {
            fullName: customer?.fullName || ctxCustomer.fullName || ctxCustomer.name,
            customerCode: customer?.customerCode || ctxCustomer.customerCode,
            mobileNumber: customer?.mobileNumber || ctxCustomer.mobileNumber,
          },
          companyName: "Wazn Express",
          generatedAt: new Date().toISOString(),
        };
      }),
    
    // Get package details with image
    getPackageDetails: customerProcedure
      .input(z.object({ packageId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        
        // Allow-listed, and scoped inside the query. Returning the row
        // whole handed over the office notes and the signed qrCodeData /
        // qrCodeSignature a scanner verifies.
        const pkg = await db.getCustomerPackageDetail(input.packageId, customerId);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        }

        return pkg;
      }),

    // Real movement history for one of the customer's own packages: merged
    // status-history + scan events with timestamps, oldest first. Powers the
    // portal tracking timeline with actual dates instead of a synthetic bar.
    getPackageTimeline: customerProcedure
      .input(z.object({ packageId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg || pkg.customerId !== customerId) return [];

        const [history, scans] = await Promise.all([
          db.getPackageStatusHistory(input.packageId),
          db.getPackageScans(input.packageId),
        ]);
        const events = [
          ...history.map((h: any) => ({ kind: "status" as const, status: h.toStatus as string, at: h.changedAt as Date })),
          ...scans.map((s: any) => ({ kind: "scan" as const, status: s.scanType as string, at: s.scannedAt as Date })),
        ].filter((e) => e.status && e.at);
        events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
        return events;
      }),
    
    // ============ UNCLAIMED PACKAGES & CLAIM REQUESTS ============
    
    // Get all unclaimed packages with search
    getUnclaimedPackages: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getUnclaimedPackagesWithSearch(input);
      }),
    
    // Create a claim request for an unclaimed package
    createClaimRequest: customerProcedure
      .input(z.object({
        packageId: z.number(),
        trackingNumber: z.string(),
        // Proof of ownership is mandatory: a written reason AND at least one
        // evidence image (purchase screenshot / supplier / WeChat photo).
        customerNote: z.string().trim().min(1).max(2000),
        proofImages: customerImagesSchema.min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;

        // Check if package exists and is unclaimed
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg || !pkg.isUnclaimed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Package is not available for claiming" });
        }

        // Check if customer already has a pending claim for this package
        const hasExisting = await db.hasExistingClaimRequest(input.packageId, customerId);
        if (hasExisting) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a pending claim for this package" });
        }

        const claim = await db.createClaimRequest({
          packageId: input.packageId,
          // The parcel's own tracking number, never the one the client sent.
          // They were two independent inputs and nothing compared them, while
          // both admin review screens displayed the customer-supplied string.
          // So a claim could show a tracking number the customer genuinely
          // owns, with genuine proof photos, while packageId pointed at a
          // different and more valuable parcel — and it would look correct.
          trackingNumber: pkg.trackingNumber ?? input.trackingNumber,
          customerId,
          customerNote: input.customerNote,
          proofImages: input.proofImages,
        });
        logPortal(ctx, customerId, "claim_request", "claim", {
          detail: input.trackingNumber,
          entityType: "claim_request",
          entityId: (claim as any)?.id,
        });
        return claim;
      }),
    
    // Get customer's claim requests
    getMyClaimRequests: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getClaimRequestsByCustomer(customerId);
    }),

    // ============ DECLARED (PRE-ALERT) PACKAGES ============
    // Customer pre-declares an incoming purchase's tracking so staff can
    // auto-own it at registration. Only the tracking number is required.
    declareIncomingPackage: customerProcedure
      .input(z.object({
        // varchar(100) in the packages table; the router accepted any
        // length and let MySQL decide.
        trackingNumber: z.string().trim().min(1).max(100),
        platform: z.string().max(100).optional(),
        productName: z.string().max(255).optional(),
        productImages: customerImagesSchema.optional(),
        categoryId: z.number().optional(),
        notes: z.string().max(2000).optional(),
        purchaseDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;

        // Another customer already waiting on this exact tracking number is
        // the one case we must not resolve by guessing: the match at
        // quick-register takes the newest declaration, so accepting this would
        // quietly move somebody else's parcel to whoever declared last.
        const conflict = await db.findConflictingDeclaration(input.trackingNumber, customerId);
        if (conflict) {
          try {
            await db.createActivityAlert({
              action: "declared_tracking_conflict",
              category: "package",
              entityType: "declared_package",
              entityId: conflict.id,
              entityCode: input.trackingNumber,
              triggeredById: customerId,
              triggeredByName: (await db.getCustomerById(customerId))?.fullName || "کڕیار",
              customTitle: "دوو کڕیار هەمان تراکیان تۆمار کردووە",
              customMessage:
                `تراکی ${input.trackingNumber} پێشتر لەلایەن کڕیارێکی ترەوە تۆمارکراوە.` +
                ` پێویستە بە دەست دیاری بکرێت هی کێیە پێش گەیشتنی.`,
              severity: "warning",
            });
          } catch {
            // The refusal below is the protection; the alert is how the office
            // hears about it, and a failed alert must not swallow the refusal.
          }
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "ئەم ژمارەی تراکە پێشتر تۆمارکراوە. تکایە پەیوەندیمان پێوە بکە تاکو دڵنیا ببینەوە هی کێیە.",
          });
        }

        const declared = await db.createDeclaredPackage({ ...input, customerId });
        logPortal(ctx, customerId, "declare_package", "declaration", {
          detail: input.trackingNumber,
          entityType: "declared_package",
          entityId: (declared as any)?.id,
        });

        // The customer activity log above is written but has no screen behind
        // it, so on its own this movement was invisible to the office. A
        // customer announcing a parcel is something the depot needs to expect,
        // so it also goes on the alert feed the office actually reads.
        try {
          const customer = await db.getCustomerById(customerId);
          await db.createActivityAlert({
            action: "customer_declared_package",
            category: "package",
            entityType: "declared_package",
            entityId: (declared as any)?.id,
            entityCode: input.trackingNumber,
            triggeredById: customerId,
            triggeredByName: customer?.fullName || customer?.customerCode || "کڕیار",
            customTitle: "کڕیار تراکێکی نوێی تۆمار کرد",
            customMessage:
              `${customer?.fullName || "کڕیار"}${customer?.customerCode ? ` (${customer.customerCode})` : ""}` +
              ` تراکی ${input.trackingNumber} ی تۆمار کرد و چاوەڕێی گەیشتنیەتی.`,
            severity: "info",
          });
        } catch {
          // The declaration itself already saved; the feed entry is secondary.
        }

        return declared;
      }),

    getMyDeclaredPackages: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getDeclaredPackagesByCustomer(customerId);
    }),

    updateDeclaredPackage: customerProcedure
      .input(z.object({
        id: z.number(),
        trackingNumber: z.string().trim().min(1).optional(),
        platform: z.string().max(100).nullable().optional(),
        productName: z.string().max(255).optional(),
        productImages: customerImagesSchema.optional(),
        categoryId: z.number().nullable().optional(),
        notes: z.string().max(2000).optional(),
        purchaseDate: z.date().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        const { id, ...data } = input;
        return db.updateDeclaredPackageForCustomer(id, customerId, data as any);
      }),

    cancelDeclaredPackage: customerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        await db.cancelDeclaredPackageForCustomer(input.id, customerId);
        return { success: true };
      }),
    
    // Get single full package order detail
    getMyFullPackageOrderDetail: customerProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        
        const order = await db.getFullPackageOrderById(input.orderId);
        if (!order || order.customerId !== customerId) return null;
        // Ownership was already checked; the payload was not. The raw row
        // carried our purchase price and profit, the supplier's phone and
        // WeChat, and the customer's own passwordHash and ID-document URLs.
        return toCustomerVisibleOrder(order as any);
      }),
    
    // ============ MESSAGES ============
    getMyMessages: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getConversationMessages(`CONV-${customerId}`);
    }),
    
    sendMessage: customerProcedure
      .input(z.object({ message: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        
        const created = await db.createCustomerMessage({
          conversationId: `CONV-${customerId}`,
          customerId,
          message: input.message,
          senderType: 'customer',
          senderId: ctx.user.id,
        });
        logPortal(ctx, customerId, "send_message", "message", { detail: input.message });
        return created;
      }),
    
    markMessagesAsRead: customerProcedure.mutation(async ({ ctx }) => {
      const customerId = ctx.customerId;
      await db.markCustomerMessagesAsRead(customerId, 'customer');
    }),
    
    getUnreadMessageCount: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getUnreadMessageCount(customerId, 'customer');
    }),
    
    // ============ NOTIFICATIONS ============
    getMyNotifications: customerProcedure
      .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        return db.getCustomerNotifications(customerId, { unreadOnly: input?.unreadOnly });
      }),
    
    markNotificationAsRead: customerProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        await db.markNotificationAsRead(input.notificationId, customerId);
        return { success: true };
      }),
    
    markAllNotificationsAsRead: customerProcedure.mutation(async ({ ctx }) => {
      const customerId = ctx.customerId;
      await db.markAllNotificationsAsRead(customerId);
    }),
    
    // getUnreadNotificationCount was a second endpoint over a second function
    // that counted exactly the same rows as getNotificationCount — the same
    // customer, the same `isRead = false`. Two copies of one number is how the
    // bell and the page came to disagree once already. There is one now.

    // ============ ADDRESSES ============
    getMyAddresses: customerProcedure.query(async ({ ctx }) => {
      const customerId = ctx.customerId;
      return db.getCustomerAddresses(customerId);
    }),
    
    createAddress: customerProcedure
      .input(z.object({
        label: z.string().min(1).max(100),
        recipientName: z.string().min(1).max(255),
        phone: z.string().min(1).max(20),
        country: z.string().max(100).default('Iraq'),
        city: z.string().min(1).max(100),
        district: z.string().max(100).optional(),
        street: z.string().max(255).optional(),
        building: z.string().max(100).optional(),
        floor: z.string().max(20).optional(),
        apartment: z.string().max(20).optional(),
        landmark: z.string().max(2000).optional(),
        notes: z.string().max(2000).optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;

        return db.createCustomerAddress({
          ...input,
          customerId,
        });
      }),
    
    updateAddress: customerProcedure
      .input(z.object({
        addressId: z.number(),
        label: z.string().max(100).optional(),
        recipientName: z.string().max(255).optional(),
        phone: z.string().max(20).optional(),
        city: z.string().max(100).optional(),
        district: z.string().max(100).optional(),
        street: z.string().max(255).optional(),
        building: z.string().max(100).optional(),
        floor: z.string().max(20).optional(),
        apartment: z.string().max(20).optional(),
        landmark: z.string().max(2000).optional(),
        notes: z.string().max(2000).optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addressId, ...data } = input;
        const address = await db.getCustomerAddressById(addressId);
        
        const customerId = ctx.customerId;
        
        if (!address || address.customerId !== customerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found' });
        }
        
        return db.updateCustomerAddress(addressId, data);
      }),
    
    deleteAddress: customerProcedure
      .input(z.object({ addressId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const address = await db.getCustomerAddressById(input.addressId);
        
        const customerId = ctx.customerId;
        
        if (!address || address.customerId !== customerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found' });
        }
        
        await db.deleteCustomerAddress(input.addressId);
        return { success: true };
      }),
    
    setDefaultAddress: customerProcedure
      .input(z.object({ addressId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const address = await db.getCustomerAddressById(input.addressId);

        const customerId = ctx.customerId;

        if (!address || address.customerId !== customerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found' });
        }

        await db.setDefaultAddress(input.addressId, customerId);
        return { success: true };
      }),

    // -----------------------------------------------------------------
    // Web Push — VAPID key + subscription management
    // -----------------------------------------------------------------
    getPushPublicKey: publicProcedure.query(() => {
      const key = getVapidPublicKey();
      return { publicKey: key, enabled: isPushEnabled() };
    }),

    subscribePush: protectedProcedure
      .input(z.object({
        endpoint: z.string().url().max(500),
        p256dh: z.string().min(1).max(255),
        auth: z.string().min(1).max(255),
        userAgent: z.string().max(500).optional(),
        platform: z.string().max(50).optional(),
        language: z.string().max(10).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // BAD_REQUEST instead of FORBIDDEN: a staff user accidentally
        // hitting subscribePush (e.g. via a stale browser tab) used to
        // get force-logged-out because FORBIDDEN tripped the auth
        // boundary. They're authenticated — just on the wrong role —
        // so return a non-auth error.
        if (!ctx.user.isCustomer) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ئەم تایبەتمەندیە تەنها بۆ هەژماری کریار بەردەستە" });
        }
        const sub = await db.upsertPushSubscription({
          customerId: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent,
          platform: input.platform,
          language: input.language,
        });
        return { success: true, id: sub?.id ?? null };
      }),

    unsubscribePush: customerProcedure
      .input(z.object({ endpoint: z.string().url().max(500) }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.customerId;
        await db.deletePushSubscriptionByEndpoint(input.endpoint, customerId);
        return { success: true };
      }),

    sendTestPush: protectedProcedure.mutation(async ({ ctx }) => {
      // BAD_REQUEST instead of FORBIDDEN — see subscribePush comment.
      if (!ctx.user.isCustomer) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ئەم تایبەتمەندیە تەنها بۆ هەژماری کریار بەردەستە" });
      }
      const result = await sendPushToCustomer(ctx.user.id, {
        title: "Wazn Express",
        body: "ئاگادارکردنەوە چالاکە ✓",
        url: "/portal",
        tag: "test-push",
      });
      return result;
    }),

    // -----------------------------------------------------------------
    // Price List — public read endpoint used by the portal home banner.
    // -----------------------------------------------------------------
    // Deliberately `publicProcedure` so the price list can also be rendered
    // on the logged-out landing page / customer login screen in a future
    // iteration. Today it is only called from authenticated portal pages,
    // but keeping it public avoids a refactor later.
    //
    // Returns { settings, shipping[], services[], rates: { rmb, iqd } } —
    // the UI picks the right language client-side from the `t()` hook so we
    // ship all four translations in one payload.
    // Portal announcement banner — set by admins in the Portal Center.
    getAnnouncement: publicProcedure.query(async () => {
      const raw = await db.getSetting("portal_announcement");
      if (!raw) return null;
      try {
        const a = JSON.parse(raw);
        return a?.enabled ? a : null;
      } catch {
        return null;
      }
    }),

    getPriceList: publicProcedure.query(async () => {
      const settings = await db.getPortalPriceListSettings();
      if (!settings || !settings.isEnabled) {
        return {
          settings: settings ?? null,
          shipping: [],
          services: [],
          rates: { rmb: null as string | null, iqd: null as string | null },
          calc: db.DEFAULT_CALC_SETTINGS,
        };
      }

      const [shipping, services, rmbRate, iqdRate, calc] = await Promise.all([
        settings.showShippingRates ? db.getPortalShippingRates() : Promise.resolve([]),
        settings.showServices ? db.getPortalServiceTypes() : Promise.resolve([]),
        settings.showRmbEquivalent ? db.getCurrentExchangeRate("RMB") : Promise.resolve(undefined),
        settings.showIqdEquivalent ? db.getCurrentExchangeRate("IQD") : Promise.resolve(undefined),
        db.getPortalCalcSettings(),
      ]);

      return {
        settings,
        shipping,
        services,
        rates: {
          rmb: rmbRate?.rate ?? null,
          iqd: iqdRate?.rate ?? null,
        },
        calc,
      };
    }),
});


// ============================================================================
// Portal Price List — ADMIN management router
// ----------------------------------------------------------------------------
// Exposes CRUD over `portalPriceListSettings` plus per-row toggles on
// pricingRules and serviceTypes' portal-display fields. Admin-only; staff
// cannot curate what customers see.
// ============================================================================

export const portalPriceListAdminRouter = router({
  // ---- Settings (single row) ----
  getSettings: adminProcedure.query(async () => {
    return db.getPortalPriceListSettings();
  }),

  updateSettings: adminProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      titleKu: z.string().max(200).nullable().optional(),
      titleEn: z.string().max(200).nullable().optional(),
      titleAr: z.string().max(200).nullable().optional(),
      titleZh: z.string().max(200).nullable().optional(),
      subtitleKu: z.string().max(400).nullable().optional(),
      subtitleEn: z.string().max(400).nullable().optional(),
      subtitleAr: z.string().max(400).nullable().optional(),
      subtitleZh: z.string().max(400).nullable().optional(),
      showShippingRates: z.boolean().optional(),
      showServices: z.boolean().optional(),
      showRmbEquivalent: z.boolean().optional(),
      showIqdEquivalent: z.boolean().optional(),
      layoutVariant: z.enum(["tabs", "stacked", "compact"]).optional(),
      position: z.enum(["top", "belowHeader", "belowStats"]).optional(),
      accentColor: z.string().max(30).optional(),
      disclaimerKu: z.string().nullable().optional(),
      disclaimerEn: z.string().nullable().optional(),
      disclaimerAr: z.string().nullable().optional(),
      disclaimerZh: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const updated = await db.updatePortalPriceListSettings(input, ctx.user.id);
      if (!updated) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save settings" });
      }
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "update_portal_price_list_settings",
        entityType: "portal_price_list_settings",
        entityId: updated.id,
        newValues: input,
      });
      return updated;
    }),

  // ---- Quick price update (the 3 portal shipping prices in one shot) ----
  getQuickPrices: adminProcedure.query(async () => {
    return db.getQuickPortalPrices();
  }),

  quickUpdatePrices: adminProcedure
    .input(z.object({
      air_regular: z.string().optional(),
      air_irregular: z.string().optional(),
      sea: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const res = await db.quickUpsertPortalPrices(input, ctx.user.id);
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "quick_update_portal_prices",
        entityType: "pricing_rule",
        entityId: 0,
        newValues: input,
      });
      return res;
    }),

  // ---- Calculator settings (ratios used by the portal price calculator) ----
  getCalcSettings: adminProcedure.query(async () => {
    return db.getPortalCalcSettings();
  }),

  updateCalcSettings: adminProcedure
    .input(z.object({
      volumetricDivisor: z.number().positive().max(100000),
      airMinKg: z.number().positive().max(1000),
      seaMinCbm: z.number().positive().max(100),
      seaSurchargePct: z.number().min(0).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.setPortalCalcSettings(input, ctx.user.id);
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "update_portal_calc_settings",
        entityType: "settings",
        entityId: 0,
        newValues: input,
      });
      return { success: true };
    }),

  // ---- Shipping rates (pricingRules with portal metadata) ----
  listShippingRatesWithMeta: adminProcedure.query(async () => {
    return db.getPricingRulesWithPortalMeta();
  }),

  updatePricingRulePortalFields: adminProcedure
    .input(z.object({
      id: z.number(),
      showOnPortal: z.boolean().optional(),
      portalLabelKu: z.string().max(150).nullable().optional(),
      portalLabelEn: z.string().max(150).nullable().optional(),
      portalLabelAr: z.string().max(150).nullable().optional(),
      portalLabelZh: z.string().max(150).nullable().optional(),
      portalIcon: z.string().max(50).nullable().optional(),
      portalColor: z.string().max(30).nullable().optional(),
      portalBadge: z.string().max(30).nullable().optional(),
      portalSortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input;
      await db.updatePricingRulePortalFields(id, fields);
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "update_pricing_rule_portal",
        entityType: "pricing_rule",
        entityId: id,
        newValues: fields,
      });
      return { success: true };
    }),

  // ---- Services (serviceTypes with portal metadata) ----
  listServicesWithMeta: adminProcedure.query(async () => {
    return db.getAllServiceTypes();
  }),

  updateServiceTypePortalFields: adminProcedure
    .input(z.object({
      id: z.number(),
      showOnPortal: z.boolean().optional(),
      portalDescriptionKu: z.string().nullable().optional(),
      portalDescriptionEn: z.string().nullable().optional(),
      portalDescriptionAr: z.string().nullable().optional(),
      portalDescriptionZh: z.string().nullable().optional(),
      portalBadge: z.string().max(30).nullable().optional(),
      portalPriceLabelKu: z.string().max(100).nullable().optional(),
      portalPriceLabelEn: z.string().max(100).nullable().optional(),
      portalPriceLabelAr: z.string().max(100).nullable().optional(),
      portalPriceLabelZh: z.string().max(100).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...fields } = input;
      await db.updateServiceTypePortalFields(id, fields);
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "update_service_type_portal",
        entityType: "service_type",
        entityId: id,
        newValues: fields,
      });
      return { success: true };
    }),
});

