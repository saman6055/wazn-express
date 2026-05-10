import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { appLogger } from "../utils/logger";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { cacheGetOrSet, CACHE_TTL } from "../db/cache";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";

export const exchangeRatesRouter = router({
    list: staffProcedure.query(async () => {
      return cacheGetOrSet("exchangeRates:all", CACHE_TTL.EXCHANGE_RATES_MS, () => db.getAllExchangeRates());
    }),
    getCurrent: staffProcedure
      .input(z.object({ currency: z.string() }))
      .query(async ({ input }) => {
        return cacheGetOrSet(`exchangeRate:${input.currency}`, CACHE_TTL.EXCHANGE_RATES_MS, () => db.getCurrentExchangeRate(input.currency));
      }),
    create: accountantProcedure
      .input(z.object({
        targetCurrency: z.string(),
        rate: z.string(),
        isManualOverride: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const rate = await db.createExchangeRate({
          ...input,
          source: input.isManualOverride ? "manual" : "api",
          createdById: ctx.user.id,
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_exchange_rate",
          entityType: "exchange_rate",
          entityId: rate.id,
          newValues: input,
        });
        return rate;
      }),
});

export const ledgerRouter = router({
    // Get financial summary
    getSummary: staffProcedure
      .query(async () => {
        return db.getFinancialSummary();
      }),
    
    // Get all customer accounts with info
    getAllAccounts: staffProcedure
      .query(async () => {
        return db.getAllCustomerAccountsWithInfo();
      }),
    
    // Get customer account by customer ID
    getAccountByCustomer: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerAccountByCustomerId(input.customerId);
      }),
    
    // Get or create customer account
    getOrCreateAccount: staffProcedure
      .input(z.object({ customerId: z.number(), customerCode: z.string() }))
      .mutation(async ({ input }) => {
        return db.getOrCreateCustomerAccount(input.customerId, input.customerCode);
      }),
    
    // Get account transactions (cursor-based pagination)
    getTransactions: staffProcedure
      .input(z.object({ accountId: z.number(), limit: z.number().min(1).max(100).default(50), cursor: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getAccountLedgerTransactions(input.accountId, { limit: input.limit, cursor: input.cursor });
      }),
    
    // Get account payments
    getPayments: staffProcedure
      .input(z.object({ accountId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getAccountPaymentRecords(input.accountId, input.limit);
      }),
    
    // Get debtors list
    getDebtors: staffProcedure
      .input(z.object({ minBalanceUsd: z.number().default(0) }))
      .query(async ({ input }) => {
        return db.getDebtors(input.minBalanceUsd);
      }),
    
    // Get total debt
    getTotalDebt: staffProcedure
      .query(async () => {
        return db.getTotalDebtAmount();
      }),
    
    // Get recent transactions
    getRecentTransactions: staffProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return db.getRecentTransactions(input.limit);
      }),

    // Get recent payments with customer name (for accountant dashboard)
    getRecentPayments: accountantProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return db.getRecentPayments(input.limit);
      }),

    // Balance distribution: debt / credit / zero counts (for accountant dashboard)
    getBalanceDistribution: accountantProcedure.query(async () => {
      return db.getBalanceDistribution();
    }),

    // Unpaid invoices summary (for accountant dashboard)
    getUnpaidInvoicesSummary: accountantProcedure.query(async () => {
      const summary = await db.getInvoiceSummary();
      return { unpaidInvoices: summary.unpaidInvoices, unpaidAmountUsd: summary.unpaidAmountUsd };
    }),

    // Record payment (cash account deposit, when provided, is done inside the same transaction — no silent failure)
    recordPayment: staffProcedure
      .input(z.object({
        customerId: idSchema,
        customerCode: z.string().max(50),
        amountUsd: amountSchema.default(0),
        amountIqd: amountSchema.default(0),
        paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'FIB', 'FASTPAY', 'ZAINCASH', 'ASIAHAWALA', 'CARD', 'OTHER']),
        notes: z.string().max(1000).optional(),
        receiptNumber: z.string().max(100).optional(),
        cashAccountId: idSchema.optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if ((input.amountUsd ?? 0) <= 0 && (input.amountIqd ?? 0) <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Payment amount must be greater than zero",
          });
        }
        const cashDescription = input.notes
          ? `پارەدانی کڕیار: ${input.customerCode} - ${input.notes}`
          : `پارەدانی کڕیار: ${input.customerCode}`;
        const result = await db.recordPaymentReceived(
          input.customerId,
          input.customerCode,
          input.amountUsd,
          input.amountIqd,
          input.paymentMethod,
          ctx.user.id,
          input.notes,
          input.receiptNumber,
          input.cashAccountId,
          cashDescription
        );
        return result;
      }),
    
    /**
     * Reverse a previously-recorded customer payment because it was
     * entered by mistake (typo / wrong customer / wrong amount). NO
     * cash physically leaves the cashbox — only the ledger is corrected.
     *
     * Restricted to accountantProcedure: this is a financially sensitive
     * operation that staff-tier users must not perform.
     */
    reversePayment: accountantProcedure
      .input(z.object({
        paymentId: idSchema,
        amountUsd: amountSchema.optional(), // omit ⇒ reverse the full remaining
        reason: z.string().min(5).max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        const payment = await db.getPaymentRecordById(input.paymentId);
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "پارەدان نەدۆزرایەوە" });
        }
        if (payment.transactionId == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ئەم پارەدانە لینکی ledger transaction-ـی نییە، ناتوانرێت بگەڕێنرێتەوە",
          });
        }
        const original = parseFloat(payment.amountUsd || '0');
        const alreadyReversed = parseFloat(payment.reversedAmountUsd || '0');
        const remaining = original - alreadyReversed;
        if (remaining <= 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ئەم پارەدانە پێشتر گەڕێنراوەتەوە" });
        }
        const requested = input.amountUsd ?? remaining;
        if (requested > remaining + 0.005) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `بڕی داواکراو ($${requested.toFixed(2)}) لە ماوە ($${remaining.toFixed(2)}) زیاترە`,
          });
        }

        const account = await db.getCustomerAccountById(payment.accountId);
        if (!account) {
          throw new TRPCError({ code: "NOT_FOUND", message: "حسابی کڕیار نەدۆزرایەوە" });
        }
        const customer = await db.getCustomerById(account.customerId);
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "کڕیار نەدۆزرایەوە" });
        }

        const result = await db.reverseAdvancePayment(
          account.customerId,
          customer.customerCode || `C${account.customerId}`,
          requested,
          `[هەڵە] ${input.reason}`,
          ctx.user.id,
          payment.transactionId,
        );

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "reverse_payment",
          entityType: "payment",
          entityId: input.paymentId,
          newValues: {
            reversedAmountUsd: requested,
            reason: input.reason,
            reversalTransactionId: result.transaction.id,
          },
        });

        return result;
      }),

    /**
     * Refund a customer's prior payment by handing real cash back from
     * one of our cashboxes. Updates BOTH the customer ledger (mirror of
     * reversePayment) AND the chosen cashbox (withdrawal).
     *
     * Restricted to accountantProcedure for the same reason as reverse.
     */
    refundPayment: accountantProcedure
      .input(z.object({
        paymentId: idSchema,
        amountUsd: amountSchema, // explicit — refund must always state the amount
        cashAccountId: idSchema,
        reason: z.string().min(5).max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.amountUsd <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "بڕی Refund پێویستە لە سفر زیاتر بێت" });
        }
        const payment = await db.getPaymentRecordById(input.paymentId);
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "پارەدان نەدۆزرایەوە" });
        }
        if (payment.transactionId == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ئەم پارەدانە لینکی ledger transaction-ـی نییە، ناتوانرێت refund بکرێت",
          });
        }
        const original = parseFloat(payment.amountUsd || '0');
        const alreadyReversed = parseFloat(payment.reversedAmountUsd || '0');
        const remaining = original - alreadyReversed;
        if (remaining <= 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ئەم پارەدانە پێشتر گەڕێنراوەتەوە" });
        }
        if (input.amountUsd > remaining + 0.005) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `بڕی داواکراو ($${input.amountUsd.toFixed(2)}) لە ماوە ($${remaining.toFixed(2)}) زیاترە`,
          });
        }

        const account = await db.getCustomerAccountById(payment.accountId);
        if (!account) {
          throw new TRPCError({ code: "NOT_FOUND", message: "حسابی کڕیار نەدۆزرایەوە" });
        }
        const customer = await db.getCustomerById(account.customerId);
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "کڕیار نەدۆزرایەوە" });
        }

        let result;
        try {
          result = await db.refundPaymentToCustomer(
            account.customerId,
            customer.customerCode || `C${account.customerId}`,
            input.amountUsd,
            input.reason,
            input.cashAccountId,
            ctx.user.id,
            payment.transactionId,
          );
        } catch (e) {
          // Insufficient-funds and missing-account errors are user-fixable —
          // surface them as BAD_REQUEST instead of an opaque 500.
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('insufficient') || msg.includes('not found')) {
            throw new TRPCError({ code: "BAD_REQUEST", message: msg });
          }
          throw e;
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "refund_payment",
          entityType: "payment",
          entityId: input.paymentId,
          newValues: {
            refundedAmountUsd: input.amountUsd,
            cashAccountId: input.cashAccountId,
            reason: input.reason,
            reversalTransactionId: result.transaction.id,
            cashTransactionId: result.cashTransactionId,
          },
        });

        return result;
      }),

    /**
     * Manual balance adjustment — posts an ADJUSTMENT_DEBIT or
     * ADJUSTMENT_CREDIT directly without reference to any payment, order,
     * or cashbox. Use ONLY when a balance is orphaned (e.g. payment record
     * was hard-deleted before we had reversal tooling) and the standard
     * reverse / refund flow can't be applied. Reason is mandatory and
     * stored on the ledger transaction so the correction is traceable.
     *
     * Restricted to accountantProcedure for the same reason as reverse /
     * refund: it directly mutates the customer's balance.
     */
    adjustBalance: accountantProcedure
      .input(z.object({
        customerId: idSchema,
        direction: z.enum(['debit', 'credit']),
        amountUsd: amountSchema,
        reason: z.string().min(5).max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.amountUsd <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "بڕی ڕێکخستن پێویستە لە سفر زیاتر بێت" });
        }
        const customer = await db.getCustomerById(input.customerId);
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "کریار نەدۆزرایەوە" });
        }

        const result = await db.adjustCustomerBalance(
          input.customerId,
          customer.customerCode || `C${input.customerId}`,
          input.amountUsd,
          input.direction,
          input.reason,
          ctx.user.id,
        );

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "adjust_balance",
          entityType: "customer_account",
          entityId: input.customerId,
          newValues: {
            direction: input.direction,
            amountUsd: input.amountUsd,
            reason: input.reason,
            adjustmentTransactionId: result.transaction.id,
            newBalanceUsd: result.newBalanceUsd,
          },
        });

        return result;
      }),

    // Record package charge (manual)
    recordCharge: staffProcedure
      .input(z.object({
        customerId: idSchema,
        customerCode: z.string().max(50),
        packageId: idSchema,
        amountUsd: amountSchema,
        description: z.string().min(1).max(1000),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.recordPackageCharge(
          input.customerId,
          input.customerCode,
          input.packageId,
          input.amountUsd,
          input.description,
          ctx.user.id
        );
      }),
    
    // Create payment reminder
    createReminder: staffProcedure
      .input(z.object({
        accountId: idSchema,
        reminderType: z.enum(['sms', 'whatsapp', 'email', 'call']),
        scheduledAt: z.date(),
        customMessage: z.string().max(1000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createPaymentReminder({
          accountId: input.accountId,
          reminderType: input.reminderType,
          scheduledAt: input.scheduledAt,
          customMessage: input.customMessage,
          createdById: ctx.user.id,
        });
      }),
    
    // Get pending reminders
    getPendingReminders: staffProcedure
      .query(async () => {
        return db.getPendingReminders();
      }),
    
    // Balance validation
    validateAccount: staffProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return db.validateAccountBalance(input.accountId);
      }),
    
    repairAccount: adminProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        return db.repairAccountBalance(input.accountId);
      }),
    
    validateAllAccounts: adminProcedure
      .query(async () => {
        return db.validateAllAccounts();
      }),
    
    getAccountBreakdown: staffProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return db.calculateAccountBreakdown(input.accountId);
      }),
    
    // ============ INVOICES ============
    
    // Generate invoice for package
    generatePackageInvoice: staffProcedure
      .input(z.object({
        packageId: idSchema,
        customerId: idSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Package not found' });
        
        const customer = await db.getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
        
        // Generate invoice number
        const invoiceNumber = await db.getNextInvoiceNumber();
        
        // Generate PDF
        const { generatePackageInvoice } = await import('../services/invoice.service');
        const pdfBuffer = await generatePackageInvoice({
          invoiceNumber,
          customerName: customer.fullName || 'Unknown',
          customerCode: customer.customerCode || '',
          packageTracking: pkg.trackingNumber || '',
          weight: parseFloat(pkg.weightKg || '0'),
          priceUsd: parseFloat(pkg.calculatedCostUsd || '0'),
          currency: 'USD',
        });
        
        // Upload to S3
        const { storagePut } = await import('../services/storage.service');
        const fileKey = `invoices/${invoiceNumber}.pdf`;
        const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, 'application/pdf');
        
        // Create invoice record
        const invoice = await db.createInvoice({
          invoiceNumber,
          customerId: input.customerId,
          packageId: input.packageId,
          subtotalUsd: pkg.calculatedCostUsd || '0',
          totalUsd: pkg.calculatedCostUsd || '0',
          status: 'issued',
          pdfUrl,
          lineItems: [{
            description: `Package Delivery - ${pkg.trackingNumber}`,
            quantity: 1,
            unitPrice: parseFloat(pkg.calculatedCostUsd || '0'),
            total: parseFloat(pkg.calculatedCostUsd || '0'),
          }],
          createdById: ctx.user.id,
        });
        
        return { invoice, pdfUrl };
      }),
    
    // Generate receipt for payment - uses paymentRecords from ledger system
    generatePaymentReceipt: staffProcedure
      .input(z.object({
        paymentRecordId: z.number(),
        customerId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const paymentRecord = await db.getPaymentRecordById(input.paymentRecordId);
        if (!paymentRecord) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment record not found' });
        
        const customer = await db.getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
        
        const account = await db.getCustomerAccountByCustomerId(input.customerId);
        const balanceAfter = parseFloat(account?.currentBalanceUsd || '0');
        
        // Generate invoice number
        const invoiceNumber = await db.getNextInvoiceNumber();
        
        // Generate PDF
        const { generatePaymentReceipt } = await import('../services/invoice.service');
        const pdfBuffer = await generatePaymentReceipt({
          invoiceNumber,
          customerName: customer.fullName || 'Unknown',
          customerCode: customer.customerCode || '',
          amountUsd: parseFloat(paymentRecord.amountUsd || '0'),
          currency: 'USD',
          paymentMethod: paymentRecord.paymentMethod || 'CASH',
          referenceNumber: paymentRecord.receiptNumber || paymentRecord.paymentNumber || `PAY-${paymentRecord.id}`,
          balanceAfter,
        });
        
        // Upload to S3
        const { storagePut } = await import('../services/storage.service');
        const fileKey = `receipts/${invoiceNumber}.pdf`;
        const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, 'application/pdf');
        
        // Create invoice record
        const invoice = await db.createInvoice({
          invoiceNumber,
          customerId: input.customerId,
          subtotalUsd: paymentRecord.amountUsd || '0',
          totalUsd: paymentRecord.amountUsd || '0',
          status: 'paid',
          pdfUrl,
          lineItems: [{
            description: 'Payment Received',
            quantity: 1,
            unitPrice: parseFloat(paymentRecord.amountUsd || '0'),
            total: parseFloat(paymentRecord.amountUsd || '0'),
          }],
          notes: paymentRecord.notes ?? undefined,
          createdById: ctx.user.id,
        });
        
        return { invoice, pdfUrl };
      }),
    
    // Get all invoices with filters
    getInvoices: staffProcedure
      .input(z.object({
        customerId: z.number().optional(),
        status: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        const page = input.limit > 0 ? Math.floor(input.offset / input.limit) + 1 : 1;
        return db.getAllInvoices({ limit: input.limit, page });
      }),
    
    // Get invoice by ID
    getInvoice: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getInvoiceById(input.id);
      }),
    
    // Balance validation procedures removed
});

export const expenseCategoriesRouter = router({
    list: accountantProcedure.query(async () => {
      return db.getAllExpenseCategories();
    }),
    listActive: accountantProcedure.query(async () => {
      return db.getActiveExpenseCategories();
    }),
    getById: accountantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getExpenseCategoryById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional(),
        isRecurring: z.boolean().default(false),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        return db.createExpenseCategory(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional(),
        isRecurring: z.boolean().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateExpenseCategory(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteExpenseCategory(input.id);
        return { success: true };
      }),
});

export const expensesRouter = router({
    list: accountantProcedure
      .input(z.object({
        categoryId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllExpenses(input);
      }),
    getById: accountantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getExpenseById(input.id);
      }),
    getSummary: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getExpensesSummary(input.startDate, input.endDate);
      }),
    create: accountantProcedure
      .input(z.object({
        categoryId: z.number(),
        amount: z.string(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        exchangeRate: z.string().optional(),
        amountUsd: z.string(),
        description: z.string().optional(),
        expenseDate: z.date(),
        receiptUrl: z.string().optional(),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'other']).default('cash'),
        cashAccountId: z.number().optional(),
        isRecurring: z.boolean().default(false),
        recurringDay: z.number().optional(),
        vendor: z.string().optional(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const expense = await db.createExpense({ ...input, createdById: ctx.user.id });
        
        // Update daily financial summary with expense
        try {
          await db.updateDailyFinancialSummary(input.expenseDate, { addExpense: parseFloat(input.amountUsd), expenseType: input.categoryId?.toString() || 'other' });
        } catch (e) {
          appLogger.error('[Finance] Failed to update daily summary for expense', { error: e instanceof Error ? e.message : String(e) });
        }
        
        // Check expense alert thresholds
        try {
          const { alertsTriggered } = await db.checkExpenseThresholds(
            parseFloat(input.amountUsd),
            input.categoryId
          );
          
          if (alertsTriggered.length > 0) {
            const { notifyOwner } = await import('../_core/notification');
            for (const triggered of alertsTriggered) {
              const currencySymbol = triggered.alert.currency === 'USD' ? '$' : 'د.ع';
              await notifyOwner({
                title: `⚠️ ئاگادارکردنەوەی خەرجی - سنوور تێپەڕا!`,
                content: `خەرجییەکان لە سنوورەکە تێپەڕیوە:\n\nماوە: ${triggered.periodLabel}\nکۆی خەرجی: ${currencySymbol}${triggered.totalExpenses.toLocaleString()}\nسنوور: ${currencySymbol}${triggered.thresholdAmount.toLocaleString()}\n${triggered.alert.description ? `تێبینی: ${triggered.alert.description}` : ''}`,
              });
            }
          }
        } catch (e) {
          appLogger.error('[ExpenseAlert] Failed to check thresholds', { error: e instanceof Error ? e.message : String(e) });
        }
        
        return expense;
      }),
    update: accountantProcedure
      .input(z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        amount: z.string().optional(),
        currency: z.enum(['USD', 'IQD']).optional(),
        exchangeRate: z.string().optional(),
        amountUsd: z.string().optional(),
        description: z.string().optional(),
        expenseDate: z.date().optional(),
        receiptUrl: z.string().optional(),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'other']).optional(),
        cashAccountId: z.number().optional(),
        isRecurring: z.boolean().optional(),
        recurringDay: z.number().optional(),
        vendor: z.string().optional(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateExpense(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteExpense(input.id);
        return { success: true };
      }),
});

export const expenseAlertsRouter = router({
    list: adminProcedure.query(async () => {
      return db.getExpenseAlerts();
    }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getExpenseAlertById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        alertType: z.enum(['daily', 'weekly', 'monthly', 'per_transaction']),
        thresholdAmount: z.string(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        categoryId: z.number().nullable().optional(),
        isEnabled: z.boolean().default(true),
        notifyMethod: z.enum(['system', 'email', 'both']).default('system'),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createExpenseAlert({ ...input, createdById: ctx.user.id });
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        alertType: z.enum(['daily', 'weekly', 'monthly', 'per_transaction']).optional(),
        thresholdAmount: z.string().optional(),
        currency: z.enum(['USD', 'IQD']).optional(),
        categoryId: z.number().nullable().optional(),
        isEnabled: z.boolean().optional(),
        notifyMethod: z.enum(['system', 'email', 'both']).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateExpenseAlert(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteExpenseAlert(input.id);
      }),
    toggle: adminProcedure
      .input(z.object({ id: z.number(), isEnabled: z.boolean() }))
      .mutation(async ({ input }) => {
        return db.toggleExpenseAlert(input.id, input.isEnabled);
      }),
    logs: adminProcedure
      .input(z.object({ alertId: z.number().optional(), limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        return db.getExpenseAlertLogs(input?.alertId, input?.limit);
      }),
});

export const partnersRouter = router({
    list: adminProcedure.query(async () => {
      return db.getAllPartners();
    }),
    listActive: adminProcedure.query(async () => {
      return db.getActivePartners();
    }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getPartnerById(input.id);
      }),
    getTransactions: adminProcedure
      .input(z.object({ partnerId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getPartnerTransactions(input.partnerId, input.limit);
      }),
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        nameKu: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        ownershipPercentage: z.string(),
        initialCapital: z.string().default('0'),
        joinDate: z.date(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createPartner(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        nameKu: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        ownershipPercentage: z.string().optional(),
        initialCapital: z.string().optional(),
        joinDate: z.date().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updatePartner(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePartner(input.id);
        return { success: true };
      }),
    // Partner transactions
    addTransaction: adminProcedure
      .input(z.object({
        partnerId: z.number(),
        transactionType: z.enum(['capital_contribution', 'profit_share', 'withdrawal', 'loan_to_company', 'loan_repayment', 'adjustment']),
        amount: z.string(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        amountUsd: z.string(),
        description: z.string().optional(),
        transactionDate: z.date(),
        periodMonth: z.number().optional(),
        periodYear: z.number().optional(),
        cashAccountId: z.number().optional(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createPartnerTransaction({ ...input, createdById: ctx.user.id });
      }),
});

export const companyDebtsRouter = router({
    list: adminProcedure.query(async () => {
      return db.getAllCompanyDebts();
    }),
    listActive: adminProcedure.query(async () => {
      return db.getActiveCompanyDebts();
    }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCompanyDebtById(input.id);
      }),
    getPayments: adminProcedure
      .input(z.object({ debtId: z.number() }))
      .query(async ({ input }) => {
        return db.getDebtPayments(input.debtId);
      }),
    create: adminProcedure
      .input(z.object({
        creditorName: z.string().min(1),
        creditorType: z.enum(['personal', 'bank', 'supplier', 'other']),
        creditorPhone: z.string().optional(),
        creditorEmail: z.string().optional(),
        principalAmount: z.string(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        principalAmountUsd: z.string(),
        interestRate: z.string().default('0'),
        totalInterest: z.string().default('0'),
        totalAmount: z.string(),
        remainingAmount: z.string(),
        startDate: z.date(),
        dueDate: z.date().optional(),
        installmentCount: z.number().optional(),
        installmentAmount: z.string().optional(),
        purpose: z.string().optional(),
        collateral: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createCompanyDebt({ ...input, paidAmount: '0', createdById: ctx.user.id });
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        creditorName: z.string().optional(),
        creditorType: z.enum(['personal', 'bank', 'supplier', 'other']).optional(),
        creditorPhone: z.string().optional(),
        creditorEmail: z.string().optional(),
        interestRate: z.string().optional(),
        dueDate: z.date().optional(),
        installmentCount: z.number().optional(),
        installmentAmount: z.string().optional(),
        status: z.enum(['active', 'paid', 'overdue', 'restructured']).optional(),
        purpose: z.string().optional(),
        collateral: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateCompanyDebt(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCompanyDebt(input.id);
        return { success: true };
      }),
    // Record debt payment
    recordPayment: adminProcedure
      .input(z.object({
        debtId: z.number(),
        amount: z.string(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        amountUsd: z.string(),
        principalPaid: z.string(),
        interestPaid: z.string().default('0'),
        paymentDate: z.date(),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'other']).default('cash'),
        cashAccountId: z.number().optional(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createDebtPayment({ ...input, createdById: ctx.user.id });
      }),
});

export const cashAccountsRouter = router({
    list: accountantProcedure.query(async () => {
      return db.getAllCashAccounts();
    }),
    listActive: accountantProcedure.query(async () => {
      return db.getActiveCashAccounts();
    }),
    getSummary: accountantProcedure.query(async () => {
      return db.getCashAccountsSummary();
    }),
    getById: accountantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCashAccountById(input.id);
      }),
    getTransactions: accountantProcedure
      .input(z.object({ accountId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getCashTransactions(input.accountId, input.limit);
      }),
    create: adminProcedure
      .input(z.object({
        accountName: z.string().min(1),
        accountNameKu: z.string().optional(),
        accountType: z.enum(['cash', 'bank', 'mobile_wallet']),
        bankName: z.string().optional(),
        accountNumber: z.string().optional(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        initialBalance: z.string().default('0'),
        description: z.string().optional(),
        isPrimary: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        return db.createCashAccount(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        accountName: z.string().optional(),
        accountNameKu: z.string().optional(),
        bankName: z.string().optional(),
        accountNumber: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        isPrimary: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateCashAccount(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCashAccount(input.id);
        return { success: true };
      }),
    // Record transaction
    recordTransaction: accountantProcedure
      .input(z.object({
        accountId: z.number(),
        transactionType: z.enum(['deposit', 'withdrawal', 'adjustment']),
        amount: z.string(),
        description: z.string().optional(),
        transactionDate: z.date(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createCashTransaction({ ...input, createdById: ctx.user.id });
      }),
    // Transfer between accounts
    transfer: accountantProcedure
      .input(z.object({
        fromAccountId: z.number(),
        toAccountId: z.number(),
        amount: z.number(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.transferBetweenAccounts(
          input.fromAccountId,
          input.toAccountId,
          input.amount,
          input.description || 'Transfer between accounts',
          ctx.user.id
        );
      }),
});

export const financialReportsRouter = router({
    getOverview: accountantProcedure.query(async () => {
      return db.getCompanyFinancialOverview();
    }),
    getProfitAndLoss: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getProfitAndLoss(input.startDate, input.endDate);
      }),
    getMonthlyTrend: accountantProcedure
      .input(z.object({ year: z.number() }))
      .query(async ({ input }) => {
        return db.getMonthlyProfitTrend(input.year);
      }),
    getDetailedPnL: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getDetailedProfitAndLoss(input.startDate, input.endDate);
      }),
    // PDF Generation endpoints
    generateProfitLossPDF: accountantProcedure
      .input(z.object({
        month: z.string(),
        year: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { generateProfitLossPDF } = await import("../services/pdf.service");
        const startDate = new Date(input.year, getMonthNumber(input.month), 1);
        const endDate = new Date(input.year, getMonthNumber(input.month) + 1, 0);
        const pnlData = await db.getProfitAndLoss(startDate, endDate);
        
        const pdfUrl = await generateProfitLossPDF({
          month: input.month,
          year: input.year,
          revenue: {
            packagePayments: pnlData.revenue.packageRevenue,
            fullPackageProfit: pnlData.revenue.fullPackageRevenue,
            otherRevenue: pnlData.revenue.otherRevenue,
            total: pnlData.revenue.totalRevenue,
          },
          expenses: {
            byCategory: pnlData.expenses.byCategory.map(c => ({ category: c.categoryName, amount: c.total })),
            total: pnlData.expenses.totalExpenses,
          },
          netProfit: pnlData.netProfit,
        });
        return { url: pdfUrl };
      }),
    generateBalanceSheetPDF: accountantProcedure
      .mutation(async () => {
        const { generateBalanceSheetPDF } = await import("../services/pdf.service");
        const overview = await db.getCompanyFinancialOverview();
        const debts = await db.getAllCompanyDebts();
        const partners = await db.getAllPartners();
        
        // Get customer receivables from ledger
        const totalReceivables = 0; // Would need to query customer accounts separately
        
        const pdfUrl = await generateBalanceSheetPDF({
          date: new Date().toLocaleDateString(),
          assets: {
            cash: overview.totalCash,
            bank: 0, // Bank is included in totalCash
            receivables: totalReceivables,
            total: overview.totalCash + totalReceivables,
          },
          liabilities: {
            debts: debts.map(d => ({ name: d.creditorName, amount: parseFloat(d.remainingAmount) })),
            total: overview.totalDebt,
          },
          equity: {
            partnerCapital: partners.reduce((sum, p) => sum + parseFloat(p.initialCapital), 0),
            retainedEarnings: partners.reduce((sum, p) => sum + parseFloat(p.currentBalance), 0),
            total: partners.reduce((sum, p) => sum + parseFloat(p.initialCapital) + parseFloat(p.currentBalance), 0),
          },
        });
        return { url: pdfUrl };
      }),
    generatePartnerReportPDF: accountantProcedure
      .input(z.object({
        partnerId: z.number(),
        startDate: z.date(),
        endDate: z.date(),
      }))
      .mutation(async ({ input }) => {
        const { generatePartnerReportPDF } = await import("../services/pdf.service");
        const partner = await db.getPartnerById(input.partnerId);
        if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
        
        const transactions = await db.getPartnerTransactions(input.partnerId);
        const filteredTxns = transactions.filter(t => {
          const txnDate = new Date(t.transactionDate);
          return txnDate >= input.startDate && txnDate <= input.endDate;
        });
        
        let balance = parseFloat(partner.initialCapital);
        const txnsWithBalance = filteredTxns.map(t => {
          const amount = t.transactionType === 'withdrawal' ? -parseFloat(t.amount) : parseFloat(t.amount);
          balance += amount;
          return {
            date: new Date(t.transactionDate).toLocaleDateString(),
            type: t.transactionType,
            description: t.description || '',
            amount,
            balance,
          };
        });
        
        const pdfUrl = await generatePartnerReportPDF({
          partner: {
            name: partner.name,
            ownershipPercentage: parseFloat(partner.ownershipPercentage),
          },
          startDate: input.startDate.toLocaleDateString(),
          endDate: input.endDate.toLocaleDateString(),
          openingBalance: parseFloat(partner.initialCapital),
          transactions: txnsWithBalance,
          closingBalance: parseFloat(partner.currentBalance),
          profitShare: 0,
        });
        return { url: pdfUrl };
      }),
    generateExpenseReportPDF: accountantProcedure
      .input(z.object({
        month: z.string(),
        year: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { generateExpenseReportPDF } = await import("../services/pdf.service");
        const startDate = new Date(input.year, getMonthNumber(input.month), 1);
        const endDate = new Date(input.year, getMonthNumber(input.month) + 1, 0);
        
        const expenses = await db.getAllExpenses({ startDate, endDate });
        const categories = await db.getAllExpenseCategories();
        
        type ExpenseType = typeof expenses[number];
        type CategoryType = typeof categories[number];
        
        const byCategory = categories.map((cat: CategoryType) => {
          const catExpenses = expenses.filter((exp: ExpenseType) => exp.categoryId === cat.id);
          const amount = catExpenses.reduce((sum: number, exp: ExpenseType) => sum + parseFloat(exp.amountUsd), 0);
          return {
            category: cat.nameEn,
            color: cat.color || '#64748b',
            amount,
            percentage: 0,
          };
        }).filter((c) => c.amount > 0);
        
        const total = byCategory.reduce((sum, c) => sum + c.amount, 0);
        byCategory.forEach(c => c.percentage = total > 0 ? (c.amount / total) * 100 : 0);
        
        const pdfUrl = await generateExpenseReportPDF({
          month: input.month,
          year: input.year,
          totalExpenses: total,
          byCategory,
          expenses: expenses.map((exp: ExpenseType) => ({
            date: new Date(exp.expenseDate).toLocaleDateString(),
            category: categories.find((c: CategoryType) => c.id === exp.categoryId)?.nameEn || 'Other',
            description: exp.description || '',
            vendor: exp.vendor || '',
            amount: parseFloat(exp.amountUsd),
          })),
        });
        return { url: pdfUrl };
      }),
    generateDebtSchedulePDF: accountantProcedure
      .mutation(async () => {
        const { generateDebtSchedulePDF } = await import("../services/pdf.service");
        const debts = await db.getAllCompanyDebts();
        
        const pdfUrl = await generateDebtSchedulePDF({
          totalDebt: debts.reduce((sum, d) => sum + parseFloat(d.remainingAmount), 0),
          debts: debts.map(d => ({
            creditor: d.creditorName,
            type: d.creditorType,
            originalAmount: parseFloat(d.principalAmountUsd),
            remainingAmount: parseFloat(d.remainingAmount),
            interestRate: parseFloat(d.interestRate || '0'),
            dueDate: d.dueDate ? new Date(d.dueDate).toLocaleDateString() : 'N/A',
            monthlyPayment: parseFloat(d.installmentAmount || '0'),
          })),
        });
        return { url: pdfUrl };
      }),
});

export const financeIntegrationRouter = router({
    // Revenue Records
    revenue: router({
      // Create revenue record
      create: accountantProcedure
        .input(z.object({
          recordDate: z.date(),
          revenueType: z.enum(['package_delivery', 'full_package_sale', 'full_package_commission', 'service_fee', 'extra_service', 'shipping_fee', 'other']),
          amountUsd: z.number().positive(),
          amountIqd: z.number().optional(),
          exchangeRate: z.number().optional(),
          costUsd: z.number().optional(),
          referenceType: z.enum(['package', 'fullPackageOrder', 'invoice', 'service', 'manual']).optional(),
          referenceId: z.number().optional(),
          customerId: z.number().optional(),
          description: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          return db.createRevenueRecord({
            ...input,
            createdById: ctx.user.id,
          });
        }),
      
      // List revenue records
      list: accountantProcedure
        .input(z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          revenueType: z.string().optional(),
          customerId: z.number().optional(),
          referenceType: z.string().optional(),
          status: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        }).optional())
        .query(async ({ input }) => {
          return db.listRevenueRecords(input || {});
        }),
      
      // Get revenue by type
      byType: accountantProcedure
        .input(z.object({
          startDate: z.date(),
          endDate: z.date(),
        }))
        .query(async ({ input }) => {
          return db.getRevenueByType(input.startDate, input.endDate);
        }),
    }),
    
    // Daily Summary
    dailySummary: router({
      // Get summary for a date
      get: accountantProcedure
        .input(z.object({ date: z.date() }))
        .query(async ({ input }) => {
          return db.getDailyFinancialSummary(input.date);
        }),
      
      // Get summary for date range
      range: accountantProcedure
        .input(z.object({
          startDate: z.date(),
          endDate: z.date(),
        }))
        .query(async ({ input }) => {
          return db.getFinancialSummaryRange(input.startDate, input.endDate);
        }),
    }),
    
    // Profit & Loss
    profitLoss: router({
      // Calculate P&L for period
      calculate: accountantProcedure
        .input(z.object({
          startDate: z.date(),
          endDate: z.date(),
        }))
        .query(async ({ input }) => {
          return db.calculateProfitLoss(input.startDate, input.endDate);
        }),
    }),
    
    // Dashboard Stats (Comprehensive P&L)
    dashboardStats: accountantProcedure
      .input(z.object({
        period: z.enum(['today', 'week', 'month', 'year']).optional(),
      }).optional())
      .query(async ({ input }) => {
        const now = new Date();
        let startDate: Date;
        let endDate = now;
        
        switch (input?.period || 'month') {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          case 'month':
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        const comprehensive = await db.getComprehensiveDashboardStats(startDate, endDate);
        
        return {
          period: input?.period || 'month',
          startDate,
          endDate,
          ...comprehensive,
        };
      }),
});

export const financeRouters = {
  exchangeRates: exchangeRatesRouter,
  ledger: ledgerRouter,
  expenseCategories: expenseCategoriesRouter,
  expenses: expensesRouter,
  expenseAlerts: expenseAlertsRouter,
  partners: partnersRouter,
  companyDebts: companyDebtsRouter,
  cashAccounts: cashAccountsRouter,
  financialReports: financialReportsRouter,
  financeIntegration: financeIntegrationRouter,
};

function getMonthNumber(month: string): number {
  const months: Record<string, number> = {
    "January": 0, "February": 1, "March": 2, "April": 3,
    "May": 4, "June": 5, "July": 6, "August": 7,
    "September": 8, "October": 9, "November": 10, "December": 11,
    "کانوونی دووەم": 0, "شوبات": 1, "ئازار": 2, "نیسان": 3,
    "ئایار": 4, "حوزەیران": 5, "تەممووز": 6, "ئاب": 7,
    "ئەیلوول": 8, "تشرینی یەکەم": 9, "تشرینی دووەم": 10, "کانوونی یەکەم": 11,
  };
  return months[month] ?? 0;
}
