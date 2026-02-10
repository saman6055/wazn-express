import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";

export const customerPortalRouter = router({
    getMyAccount: protectedProcedure.query(async ({ ctx }) => {
      // For merged model, the user IS the customer if isCustomer is true
      if (ctx.user.isCustomer) {
        const customer = ctx.user as any;
        return {
          id: customer.id,
          customerCode: customer.customerCode,
          fullName: customer.fullName || customer.name,
          mobileNumber: customer.mobileNumber,
          email: customer.email,
          country: customer.country,
          city: customer.city,
          address: customer.address,
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
        customerNote: z.string().optional(),
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
        });
      }),
    
    // Get customer's claim requests
    getMyClaimRequests: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getClaimRequestsByCustomer(customerId);
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
        if (!customerId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Customer not found' });
        
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
        if (!customerId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Customer not found' });
        
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
});

