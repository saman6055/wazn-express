import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";

export const extraServicesRouter = router({
    // Get all service types
    getServiceTypes: staffProcedure.query(async () => {
      return db.getAllServiceTypes();
    }),
    
    // Get active service types
    getActiveServiceTypes: staffProcedure.query(async () => {
      return db.getActiveServiceTypes();
    }),
    
    // Create service type
    createServiceType: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameKu: z.string().optional(),
        nameAr: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        defaultCost: z.string().optional(),
        defaultPrice: z.string().optional(),
        requiresCustomer: z.boolean().default(true),
        addToCustomerBalance: z.boolean().default(true),
        sortOrder: z.number().default(0),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createServiceType({
          ...input,
          createdById: ctx.user.id,
        });
      }),
    
    // Update service type
    updateServiceType: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().min(1).optional(),
        nameKu: z.string().optional(),
        nameAr: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        defaultCost: z.string().optional(),
        defaultPrice: z.string().optional(),
        requiresCustomer: z.boolean().optional(),
        addToCustomerBalance: z.boolean().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateServiceType(id, data);
      }),
    
    // Delete service type
    deleteServiceType: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteServiceType(input.id);
        return { success: true };
      }),
    
    // Get extra services for a customer
    getByCustomer: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getExtraServicesWithDetails(input.customerId);
      }),
    
    // Get all extra services with filters
    list: staffProcedure
      .input(z.object({
        customerId: z.number().optional(),
        serviceTypeId: z.number().optional(),
        isPaid: z.boolean().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getAllExtraServices({
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        });
      }),
    
    // Create extra service
    create: staffProcedure
      .input(z.object({
        serviceTypeId: z.number(),
        customerId: z.number().optional(),
        description: z.string().min(1),
        costAmount: z.string(),
        priceAmount: z.string(),
        currency: z.enum(["USD", "IQD", "CNY"]).default("USD"),
        exchangeRate: z.string().optional(),
        notes: z.string().optional(),
        addToBalance: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const service = await db.createExtraService({
          serviceTypeId: input.serviceTypeId,
          customerId: input.customerId,
          description: input.description,
          costAmount: input.costAmount,
          priceAmount: input.priceAmount,
          currency: input.currency,
          exchangeRate: input.exchangeRate,
          notes: input.notes,
          createdById: ctx.user.id,
        });
        
        // Add to customer balance if requested and customer exists
        if (input.addToBalance && input.customerId) {
          const account = await db.getCustomerAccountByCustomerId(input.customerId);
          if (account) {
            const currentBalance = Number(account.currentBalanceUsd);
            const newBalance = currentBalance + Number(input.priceAmount);
            
            // Create ledger transaction
            const txnNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            await db.createLedgerTransaction({
              accountId: account.id,
              transactionNumber: txnNumber,
              transactionType: "DEBIT_SERVICE",
              amountUsd: input.priceAmount,
              balanceBeforeUsd: currentBalance.toFixed(2),
              balanceAfterUsd: newBalance.toFixed(2),
              balanceBeforeIqd: account.currentBalanceIqd,
              balanceAfterIqd: account.currentBalanceIqd,
              referenceType: "service",
              referenceId: service.id,
              description: `Extra service: ${input.description}`,
              createdById: ctx.user.id,
            });
            
            // Update account balance
            await db.updateCustomerAccountBalance(
              account.id,
              newBalance.toFixed(2),
              account.currentBalanceIqd,
              { debitUsd: input.priceAmount }
            );
            
            // Mark service as added to balance
            await db.updateExtraService(service.id, { addedToBalance: true });
            
            // Create professional invoice for extra service
            try {
              const serviceType = await db.getServiceTypeById(input.serviceTypeId);
              const customer = await db.getCustomerById(input.customerId);
              const invoiceNumber = `INV-SVC-${Date.now()}-${service.id}`;
              const priceAmount = Number(input.priceAmount);
              
              // Get current exchange rates
              const iqdRate = await db.getCurrentExchangeRate("IQD");
              const rmbRate = await db.getCurrentExchangeRate("RMB");
              
              const lineItems = [{
                description: `${serviceType?.nameKu || serviceType?.nameEn || 'خزمەتگوزاری'}: ${input.description}`,
                quantity: 1,
                unitPrice: priceAmount,
                total: priceAmount,
              }];
              
              const invoice = await db.createInvoice({
                invoiceNumber,
                customerId: input.customerId,
                subtotalUsd: priceAmount.toFixed(2),
                totalUsd: priceAmount.toFixed(2),
                exchangeRateIqd: iqdRate?.rate,
                exchangeRateRmb: rmbRate?.rate,
                totalIqd: iqdRate ? (priceAmount * parseFloat(iqdRate.rate)).toFixed(0) : undefined,
                totalRmb: rmbRate ? (priceAmount * parseFloat(rmbRate.rate)).toFixed(2) : undefined,
                lineItems: lineItems,
                status: 'issued' as const,
                issuedAt: new Date(),
                notes: `وەسڵی خزمەتگوزاری - ${customer?.fullName || ''} - ${input.description}`,
                createdById: ctx.user.id,
              });
              
              // Link invoice to extra service
              if (invoice) {
                await db.linkExtraServiceToInvoice(service.id, invoice.id);
              }
              
              console.log('[Invoice-SVC] Created invoice for extra service:', invoice?.id);
            } catch (e) {
              console.error('[Invoice-SVC] Failed to create invoice for extra service:', e);
            }
          }
        }
        
        return service;
      }),
    
    // Update extra service
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        description: z.string().optional(),
        costAmount: z.string().optional(),
        priceAmount: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateExtraService(id, data);
      }),
    
    // Delete extra service
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteExtraService(input.id);
        return { success: true };
      }),
    
    // Mark as paid
    markAsPaid: staffProcedure
      .input(z.object({
        id: z.number(),
        paymentMethod: z.enum(["cash", "card", "transfer", "balance"]),
        paidAmount: z.string(),
      }))
      .mutation(async ({ input }) => {
        return db.markExtraServiceAsPaid(input.id, input.paymentMethod, input.paidAmount);
      }),
    
    // Get summary for reports
    getSummary: staffProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.getExtraServicesSummary(
          input.startDate ? new Date(input.startDate) : undefined,
          input.endDate ? new Date(input.endDate) : undefined
        );
      }),
    
    // Get unpaid services for customer
    getUnpaid: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getUnpaidExtraServices(input.customerId);
      }),
});

export const notificationTemplatesRouter = router({
    list: adminProcedure.query(async () => {
      return db.getNotificationTemplates();
    }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getNotificationTemplateById(input.id);
      }),
    
    getByEvent: adminProcedure
      .input(z.object({ eventType: z.string() }))
      .query(async ({ input }) => {
        return db.getNotificationTemplateByEvent(input.eventType);
      }),
    
    create: adminProcedure
      .input(z.object({
        eventType: z.enum(["package_received", "package_shipped", "package_arrived", "package_delivered", "payment_received", "invoice_created", "batch_shipped", "batch_arrived", "custom"]),
        name: z.string().min(1),
        isActive: z.boolean().optional(),
        smsTemplate: z.string().optional(),
        smsTemplateAr: z.string().optional(),
        smsTemplateKu: z.string().optional(),
        whatsappTemplate: z.string().optional(),
        whatsappTemplateAr: z.string().optional(),
        whatsappTemplateKu: z.string().optional(),
        emailSubject: z.string().optional(),
        emailSubjectAr: z.string().optional(),
        emailSubjectKu: z.string().optional(),
        emailTemplate: z.string().optional(),
        emailTemplateAr: z.string().optional(),
        emailTemplateKu: z.string().optional(),
        pushTitle: z.string().optional(),
        pushTitleAr: z.string().optional(),
        pushTitleKu: z.string().optional(),
        pushTemplate: z.string().optional(),
        pushTemplateAr: z.string().optional(),
        pushTemplateKu: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createNotificationTemplate(input);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        smsTemplate: z.string().optional(),
        smsTemplateAr: z.string().optional(),
        smsTemplateKu: z.string().optional(),
        whatsappTemplate: z.string().optional(),
        whatsappTemplateAr: z.string().optional(),
        whatsappTemplateKu: z.string().optional(),
        emailSubject: z.string().optional(),
        emailSubjectAr: z.string().optional(),
        emailSubjectKu: z.string().optional(),
        emailTemplate: z.string().optional(),
        emailTemplateAr: z.string().optional(),
        emailTemplateKu: z.string().optional(),
        pushTitle: z.string().optional(),
        pushTitleAr: z.string().optional(),
        pushTitleKu: z.string().optional(),
        pushTemplate: z.string().optional(),
        pushTemplateAr: z.string().optional(),
        pushTemplateKu: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateNotificationTemplate(id, data);
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteNotificationTemplate(input.id);
        return { success: true };
      }),
    
    ensureDefaults: adminProcedure.mutation(async () => {
      await db.ensureDefaultNotificationTemplates();
      return { success: true };
    }),
});

export const labelTemplatesRouter = router({
    list: adminProcedure.query(async () => {
      return db.getLabelTemplates();
    }),
    
    getDefault: adminProcedure.query(async () => {
      return db.getDefaultLabelTemplate();
    }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getLabelTemplateById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        isDefault: z.boolean().optional(),
        size: z.enum(["10x15", "10x10", "A6", "A5", "custom"]).optional(),
        widthMm: z.number().optional(),
        heightMm: z.number().optional(),
        showQrCode: z.boolean().optional(),
        qrCodeSize: z.number().optional(),
        qrCodePosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).optional(),
        showBarcode: z.boolean().optional(),
        barcodeType: z.enum(["code128", "code39", "ean13", "qr"]).optional(),
        showLogo: z.boolean().optional(),
        logoUrl: z.string().optional(),
        logoWidth: z.number().optional(),
        showTrackingNumber: z.boolean().optional(),
        showCustomerName: z.boolean().optional(),
        showCustomerCode: z.boolean().optional(),
        showCustomerPhone: z.boolean().optional(),
        showDestinationCity: z.boolean().optional(),
        showWeight: z.boolean().optional(),
        showDimensions: z.boolean().optional(),
        showShippingType: z.boolean().optional(),
        showBatchNumber: z.boolean().optional(),
        showDate: z.boolean().optional(),
        showPrice: z.boolean().optional(),
        primaryColor: z.string().optional(),
        fontFamily: z.string().optional(),
        fontSize: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createLabelTemplate(input);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        isDefault: z.boolean().optional(),
        size: z.enum(["10x15", "10x10", "A6", "A5", "custom"]).optional(),
        widthMm: z.number().optional(),
        heightMm: z.number().optional(),
        showQrCode: z.boolean().optional(),
        qrCodeSize: z.number().optional(),
        qrCodePosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).optional(),
        showBarcode: z.boolean().optional(),
        barcodeType: z.enum(["code128", "code39", "ean13", "qr"]).optional(),
        showLogo: z.boolean().optional(),
        logoUrl: z.string().optional(),
        logoWidth: z.number().optional(),
        showTrackingNumber: z.boolean().optional(),
        showCustomerName: z.boolean().optional(),
        showCustomerCode: z.boolean().optional(),
        showCustomerPhone: z.boolean().optional(),
        showDestinationCity: z.boolean().optional(),
        showWeight: z.boolean().optional(),
        showDimensions: z.boolean().optional(),
        showShippingType: z.boolean().optional(),
        showBatchNumber: z.boolean().optional(),
        showDate: z.boolean().optional(),
        showPrice: z.boolean().optional(),
        primaryColor: z.string().optional(),
        fontFamily: z.string().optional(),
        fontSize: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateLabelTemplate(id, data);
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLabelTemplate(input.id);
        return { success: true };
      }),
    
    setDefault: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.setDefaultLabelTemplate(input.id);
      }),
    
    ensureDefault: adminProcedure.mutation(async () => {
      return db.ensureDefaultLabelTemplate();
    }),
});

export const alertsRouter = router({
    // Get alert summary for dashboard
    getSummary: staffProcedure.query(async () => {
      return db.getAlertSummary();
    }),

    // Get packages with alerts
    getPackages: staffProcedure
      .input(z.object({
        alertStatus: z.enum(["normal", "warning", "high_risk"]).optional(),
        status: z.string().optional(),
        customerId: z.number().optional(),
        batchId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getPackagesWithAlerts(input);
      }),

    // Get batches with alerts
    getBatches: staffProcedure
      .input(z.object({
        alertStatus: z.enum(["normal", "warning", "high_risk"]).optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getBatchesWithAlerts(input);
      }),
});

export const blogRouter = router({
    // Get all blog posts (admin)
    list: staffProcedure.query(async () => {
      return db.getAllBlogPosts();
    }),
    
    // Get published posts (public)
    published: publicProcedure.query(async () => {
      return db.getPublishedBlogPosts();
    }),
    
    // Get featured posts (public)
    featured: publicProcedure.query(async () => {
      return db.getFeaturedBlogPosts();
    }),
    
    // Get by ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const post = await db.getBlogPostById(input.id);
        if (post) {
          // Increment view count
          await db.incrementBlogViewCount(input.id);
        }
        return post;
      }),
    
    // Get by slug
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const post = await db.getBlogPostBySlug(input.slug);
        if (post) {
          await db.incrementBlogViewCount(post.id);
        }
        return post;
      }),
    
    // Get by category
    getByCategory: publicProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        return db.getBlogPostsByCategory(input.category);
      }),
    
    // Create blog post
    create: staffProcedure
      .input(z.object({
        titleEn: z.string().optional(),
        titleKu: z.string().optional(),
        titleAr: z.string().optional(),
        contentEn: z.string().optional(),
        contentKu: z.string().optional(),
        contentAr: z.string().optional(),
        summaryEn: z.string().optional(),
        summaryKu: z.string().optional(),
        summaryAr: z.string().optional(),
        coverImageUrl: z.string().optional(),
        category: z.enum(['announcement', 'news', 'promotion', 'update', 'guide']).optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
        isFeatured: z.boolean().optional(),
        publishedAt: z.date().optional(),
        expiresAt: z.date().optional(),
        slug: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Validate at least one language has title and content
        const hasTitle = input.titleEn || input.titleKu || input.titleAr;
        const hasContent = input.contentEn || input.contentKu || input.contentAr;
        if (!hasTitle || !hasContent) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'At least one language must have title and content' });
        }
        return db.createBlogPost({
          titleEn: input.titleEn || '',
          contentEn: input.contentEn || '',
          titleKu: input.titleKu,
          titleAr: input.titleAr,
          contentKu: input.contentKu,
          contentAr: input.contentAr,
          summaryEn: input.summaryEn,
          summaryKu: input.summaryKu,
          summaryAr: input.summaryAr,
          coverImageUrl: input.coverImageUrl,
          category: input.category,
          status: input.status,
          isFeatured: input.isFeatured,
          expiresAt: input.expiresAt,
          slug: input.slug,
          authorId: ctx.user.id,
          publishedAt: input.status === 'published' ? (input.publishedAt || new Date()) : undefined,
        });
      }),
    
    // Update blog post
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().optional(),
        titleKu: z.string().optional(),
        titleAr: z.string().optional(),
        contentEn: z.string().optional(),
        contentKu: z.string().optional(),
        contentAr: z.string().optional(),
        summaryEn: z.string().optional(),
        summaryKu: z.string().optional(),
        summaryAr: z.string().optional(),
        coverImageUrl: z.string().optional(),
        category: z.enum(['announcement', 'news', 'promotion', 'update', 'guide']).optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
        isFeatured: z.boolean().optional(),
        publishedAt: z.date().optional(),
        expiresAt: z.date().optional(),
        slug: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        // If publishing for first time, set publishedAt
        if (data.status === 'published') {
          const existing = await db.getBlogPostById(id);
          if (existing && existing.status !== 'published' && !data.publishedAt) {
            data.publishedAt = new Date();
          }
        }
        return db.updateBlogPost(id, data);
      }),
    
    // Delete blog post
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteBlogPost(input.id);
      }),
    
    // Upload cover image
    uploadCoverImage: staffProcedure
      .input(z.object({
        fileData: z.string(), // base64 encoded file data
        fileName: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("../storage");
        const { nanoid } = await import("nanoid");
        
        // Decode base64 to buffer
        const buffer = Buffer.from(input.fileData, "base64");
        
        // Generate unique filename
        const ext = input.fileName.split(".").pop() || "jpg";
        const uniqueFileName = `blog-covers/${nanoid(12)}.${ext}`;
        
        // Upload to S3
        const { url } = await storagePut(uniqueFileName, buffer, input.mimeType);
        
        return { success: true, url };
      }),
});

export const storageRouter = router({
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        contentType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("../storage");
        const { nanoid } = await import("nanoid");
        
        // Decode base64 to buffer
        const buffer = Buffer.from(input.base64Data, "base64");
        
        // Generate unique filename
        const ext = input.fileName.split(".").pop() || "jpg";
        const uniqueFileName = `uploads/${nanoid(12)}.${ext}`;
        
        // Upload to S3
        const { url } = await storagePut(uniqueFileName, buffer, input.contentType);
        
        return { success: true, url };
      }),
});

export const servicesRouters = {
  extraServices: extraServicesRouter,
  notificationTemplates: notificationTemplatesRouter,
  labelTemplates: labelTemplatesRouter,
  alerts: alertsRouter,
  blog: blogRouter,
  storage: storageRouter,
};
