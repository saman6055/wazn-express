import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";
import { getVapidPublicKey, isPushEnabled, sendPushToCustomer } from "../services/push.service";

export const customerPortalRouter = router({
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
        };
      }
      // Legacy: find customer linked to this user
      const customer = await db.getCustomerByUserId(ctx.user.id);
      return customer;
    }),
    getMyPackages: protectedProcedure.query(async ({ ctx }) => {
      // For merged model, use user.id directly as customerId
      if (ctx.user.isCustomer) {
        return db.getPackagesByCustomer(ctx.user.id);
      }
      // Legacy
      const customer = await db.getCustomerByUserId(ctx.user.id);
      if (!customer) return [];
      return db.getPackagesByCustomer(customer.id);
    }),
    getMyInvoices: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
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
    getMyBatches: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getCustomerBatches(customerId);
    }),
    
    // Get customer's packages in a specific batch
    getMyPackagesInBatch: protectedProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return [];
        return db.getCustomerPackagesInBatch(customerId, input.batchId);
      }),
    
    // Get unbatched packages
    getMyUnbatchedPackages: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getCustomerUnbatchedPackages(customerId);
    }),
    
    // Get customer's full package orders (for customer portal)
    getMyFullPackageOrders: protectedProcedure
      .input(z.object({
        orderType: z.enum(["full_package", "commission", "purchase_request"]).optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id :
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return [];
        return db.getFullPackageOrdersByCustomer(customerId, input);
      }),

    /**
     * Customer-facing summary of pending (not-yet-delivered, uncharged) orders.
     * Powers the "Awaiting Delivery" card on the portal home — so customers
     * can see at a glance how many orders are still flowing through the
     * pipeline and what the estimated invoice total will be.
     */
    getMyPendingOrders: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id :
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) {
        return {
          count: 0,
          totalPriceUsd: 0,
          oldestAt: null,
          byType: { full_package: 0, commission: 0, purchase_request: 0 },
        };
      }

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
    getMyFinancialSummary: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return null;
      return db.getCustomerFinancialSummary(customerId);
    }),
    
    // Get transaction history
    getMyTransactions: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return [];
        return db.getCustomerTransactionHistory(customerId, input?.limit || 50);
      }),
    
    // Search package by tracking number
    searchPackage: protectedProcedure
      .input(z.object({ trackingNumber: z.string() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return null;
        return db.searchCustomerPackage(customerId, input.trackingNumber);
      }),

    // Unified-search fallback: when a tracking isn't one of the customer's own
    // registered packages, tell them what else we know — is it sitting
    // unclaimed (claimable), or did they pre-declare it (awaiting arrival)?
    searchTrackingExtra: protectedProcedure
      .input(z.object({ trackingNumber: z.string().trim().min(1) }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id :
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return { unclaimed: null, declared: null };
        const pkg = await db.getPackageByTrackingNumber(input.trackingNumber);
        const unclaimed = pkg && pkg.isUnclaimed ? pkg : null;
        const declared = await db.findCustomerDeclaredByTracking(customerId, input.trackingNumber);
        return { unclaimed, declared };
      }),
    
    // Get notification count
    getNotificationCount: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return 0;
      return db.getCustomerNotificationCount(customerId);
    }),
    
    // Generate PDF receipt for a transaction
    getReceiptData: protectedProcedure
      .input(z.object({ transactionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        
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
    getPackageDetails: protectedProcedure
      .input(z.object({ packageId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg || pkg.customerId !== customerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        }
        
        return pkg;
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
    createClaimRequest: protectedProcedure
      .input(z.object({
        packageId: z.number(),
        trackingNumber: z.string(),
        // Proof of ownership is mandatory: a written reason AND at least one
        // evidence image (purchase screenshot / supplier / WeChat photo).
        customerNote: z.string().trim().min(1),
        proofImages: z.array(z.string()).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id :
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

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

        return db.createClaimRequest({
          packageId: input.packageId,
          trackingNumber: input.trackingNumber,
          customerId,
          customerNote: input.customerNote,
          proofImages: input.proofImages,
        });
      }),
    
    // Get customer's claim requests
    getMyClaimRequests: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id :
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getClaimRequestsByCustomer(customerId);
    }),

    // ============ DECLARED (PRE-ALERT) PACKAGES ============
    // Customer pre-declares an incoming purchase's tracking so staff can
    // auto-own it at registration. Only the tracking number is required.
    declareIncomingPackage: protectedProcedure
      .input(z.object({
        trackingNumber: z.string().trim().min(1),
        platform: z.enum(["taobao", "pinduoduo", "alibaba", "1688", "aliexpress", "weixin", "other"]).optional(),
        productName: z.string().max(255).optional(),
        productImages: z.array(z.string()).optional(),
        categoryId: z.number().optional(),
        notes: z.string().max(2000).optional(),
        purchaseDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id :
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "پرۆفایلی کریار نەدۆزرایەوە بۆ ئەم هەژمارە." });
        return db.createDeclaredPackage({ ...input, customerId });
      }),

    getMyDeclaredPackages: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id :
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getDeclaredPackagesByCustomer(customerId);
    }),

    updateDeclaredPackage: protectedProcedure
      .input(z.object({
        id: z.number(),
        trackingNumber: z.string().trim().min(1).optional(),
        platform: z.enum(["taobao", "pinduoduo", "alibaba", "1688", "aliexpress", "weixin", "other"]).nullable().optional(),
        productName: z.string().max(255).optional(),
        productImages: z.array(z.string()).optional(),
        categoryId: z.number().nullable().optional(),
        notes: z.string().max(2000).optional(),
        purchaseDate: z.date().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id :
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "پرۆفایلی کریار نەدۆزرایەوە." });
        const { id, ...data } = input;
        return db.updateDeclaredPackageForCustomer(id, customerId, data as any);
      }),

    cancelDeclaredPackage: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id :
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "پرۆفایلی کریار نەدۆزرایەوە." });
        await db.cancelDeclaredPackageForCustomer(input.id, customerId);
        return { success: true };
      }),
    
    // Get single full package order detail
    getMyFullPackageOrderDetail: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return null;
        
        const order = await db.getFullPackageOrderById(input.orderId);
        if (!order || order.customerId !== customerId) return null;
        return order;
      }),
    
    // ============ MESSAGES ============
    getMyMessages: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getConversationMessages(`CONV-${customerId}`);
    }),
    
    sendMessage: protectedProcedure
      .input(z.object({ message: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id :
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        // BAD_REQUEST, not FORBIDDEN: the user IS authenticated, they
        // just don't have a customer profile attached to their account.
        // Throwing FORBIDDEN used to trip QueryErrorBoundary's auth
        // heuristics and bounce the user to login mid-session.
        if (!customerId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'پرۆفایلی کریار نەدۆزرایەوە بۆ ئەم هەژمارە. تکایە لەگەڵ پشتگیرییەوە پەیوەندی بکە.' });
        
        return db.createCustomerMessage({
          conversationId: `CONV-${customerId}`,
          customerId,
          message: input.message,
          senderType: 'customer',
          senderId: ctx.user.id,
        });
      }),
    
    markMessagesAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return;
      await db.markCustomerMessagesAsRead(customerId, 'customer');
    }),
    
    getUnreadMessageCount: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return 0;
      return db.getUnreadMessageCount(customerId, 'customer');
    }),
    
    // ============ NOTIFICATIONS ============
    getMyNotifications: protectedProcedure
      .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return [];
        return db.getCustomerNotifications(customerId, { unreadOnly: input?.unreadOnly });
      }),
    
    markNotificationAsRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markNotificationAsRead(input.notificationId);
        return { success: true };
      }),
    
    markAllNotificationsAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return;
      await db.markAllNotificationsAsRead(customerId);
    }),
    
    getUnreadNotificationCount: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return 0;
      return db.getUnreadNotificationCount(customerId);
    }),
    
    // ============ ADDRESSES ============
    getMyAddresses: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getCustomerAddresses(customerId);
    }),
    
    createAddress: protectedProcedure
      .input(z.object({
        label: z.string().min(1),
        recipientName: z.string().min(1),
        phone: z.string().min(1),
        country: z.string().default('Iraq'),
        city: z.string().min(1),
        district: z.string().optional(),
        street: z.string().optional(),
        building: z.string().optional(),
        floor: z.string().optional(),
        apartment: z.string().optional(),
        landmark: z.string().optional(),
        notes: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id :
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        // BAD_REQUEST instead of FORBIDDEN — see sendMessage comment.
        if (!customerId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'پرۆفایلی کریار نەدۆزرایەوە بۆ ئەم هەژمارە. تکایە لەگەڵ پشتگیرییەوە پەیوەندی بکە.' });

        return db.createCustomerAddress({
          ...input,
          customerId,
        });
      }),
    
    updateAddress: protectedProcedure
      .input(z.object({
        addressId: z.number(),
        label: z.string().optional(),
        recipientName: z.string().optional(),
        phone: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        street: z.string().optional(),
        building: z.string().optional(),
        floor: z.string().optional(),
        apartment: z.string().optional(),
        landmark: z.string().optional(),
        notes: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addressId, ...data } = input;
        const address = await db.getCustomerAddressById(addressId);
        
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        
        if (!address || address.customerId !== customerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found' });
        }
        
        return db.updateCustomerAddress(addressId, data);
      }),
    
    deleteAddress: protectedProcedure
      .input(z.object({ addressId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const address = await db.getCustomerAddressById(input.addressId);
        
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        
        if (!address || address.customerId !== customerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found' });
        }
        
        await db.deleteCustomerAddress(input.addressId);
        return { success: true };
      }),
    
    setDefaultAddress: protectedProcedure
      .input(z.object({ addressId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const address = await db.getCustomerAddressById(input.addressId);

        const customerId = ctx.user.isCustomer ? ctx.user.id :
          (await db.getCustomerByUserId(ctx.user.id))?.id;

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

    unsubscribePush: protectedProcedure
      .input(z.object({ endpoint: z.string().url().max(500) }))
      .mutation(async ({ input }) => {
        await db.deletePushSubscriptionByEndpoint(input.endpoint);
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
    getPriceList: publicProcedure.query(async () => {
      const settings = await db.getPortalPriceListSettings();
      if (!settings || !settings.isEnabled) {
        return {
          settings: settings ?? null,
          shipping: [],
          services: [],
          rates: { rmb: null as string | null, iqd: null as string | null },
        };
      }

      const [shipping, services, rmbRate, iqdRate] = await Promise.all([
        settings.showShippingRates ? db.getPortalShippingRates() : Promise.resolve([]),
        settings.showServices ? db.getPortalServiceTypes() : Promise.resolve([]),
        settings.showRmbEquivalent ? db.getCurrentExchangeRate("RMB") : Promise.resolve(undefined),
        settings.showIqdEquivalent ? db.getCurrentExchangeRate("IQD") : Promise.resolve(undefined),
      ]);

      return {
        settings,
        shipping,
        services,
        rates: {
          rmb: rmbRate?.rate ?? null,
          iqd: iqdRate?.rate ?? null,
        },
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

