import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { appLogger } from "../utils/logger";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { notifyPackageStatusChange } from "../services/notification.service";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";

export const qrCodesRouter = router({
    generate: staffProcedure
      .input(z.object({
        packageId: z.number(),
        packageType: z.enum(["regular", "full_package"]).default("regular"),
      }))
      .mutation(async ({ input }) => {
        // Check if QR already exists
        const existing = await db.getQrCodeByPackage(input.packageId, input.packageType);
        if (existing) {
          return existing;
        }
        
        // Generate unique QR code
        const qrCode = `WZN-${input.packageType === 'full_package' ? 'FP' : 'PK'}-${input.packageId}-${Date.now().toString(36).toUpperCase()}`;
        
        return db.createPackageQrCode({
          packageId: input.packageId,
          packageType: input.packageType,
          qrCode,
        });
      }),
    
    scan: staffProcedure
      .input(z.object({ qrCode: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const qr = await db.getQrCodeByCode(input.qrCode);
        if (!qr) {
          throw new TRPCError({ code: "NOT_FOUND", message: "QR code not found" });
        }
        
        await db.updateQrCodeScan(input.qrCode, ctx.user.id);
        
        // Get package details
        if (qr.packageType === 'regular') {
          const pkg = await db.getPackageById(qr.packageId);
          return { type: 'regular', package: pkg, qr };
        } else {
          const order = await db.getFullPackageOrderById(qr.packageId);
          return { type: 'full_package', order, qr };
        }
      }),
    
    getByPackage: staffProcedure
      .input(z.object({
        packageId: z.number(),
        packageType: z.enum(["regular", "full_package"]).default("regular"),
      }))
      .query(async ({ input }) => {
        return db.getQrCodeByPackage(input.packageId, input.packageType);
      }),
});

export const scanningRouter = router({
    // Search tracking number in all order types (full_package, purchase_request, commission, package)
    searchTrackingAllTypes: staffProcedure
      .input(z.object({ trackingNumber: z.string().min(1) }))
      .query(async ({ input }) => {
        return db.searchTrackingInAllOrderTypes(input.trackingNumber);
      }),
    
    // Search package by tracking number or barcode
    searchByTracking: staffProcedure
      .input(z.object({ trackingNumber: z.string().min(1) }))
      .query(async ({ input }) => {
        const result = await db.getPackageWithCustomerByTracking(input.trackingNumber);
        if (!result) {
          // Check if any scans exist for this tracking
          const scans = await db.getScansByTracking(input.trackingNumber);
          return { found: false, scans, package: null, customer: null };
        }
        
        // Get scan history
        const scans = await db.getPackageScans(result.package.id);
        const statusHistory = await db.getPackageStatusHistory(result.package.id);
        
        return { 
          found: true, 
          package: result.package, 
          customer: result.customer,
          scans,
          statusHistory
        };
      }),
    
    // Register a new scan
    registerScan: staffProcedure
      .input(z.object({
        trackingNumber: z.string().min(1),
        scanType: z.enum([
          "registered", "received_china", "in_batch", "in_transit",
          "received_local", "out_for_delivery", "delivered", "returned", "customs_hold"
        ]),
        packageId: z.number().optional(),
        warehouseId: z.number().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        locationName: z.string().optional(),
        notes: z.string().optional(),
        photoUrl: z.string().optional(),
        deviceIdentifier: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Create the scan record
        const scan = await db.createPackageScan({
          trackingNumber: input.trackingNumber,
          packageId: input.packageId,
          scanType: input.scanType,
          scannedById: ctx.user.id,
          warehouseId: input.warehouseId,
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          locationName: input.locationName,
          notes: input.notes,
          photoUrl: input.photoUrl,
        });
        
        // If package exists, update its status
        if (input.packageId) {
          const statusMap: Record<string, string> = {
            'registered': 'Registered',
            'received_china': 'In China Warehouse',
            'in_batch': 'In Batch',
            'in_transit': 'In Transit',
            'received_local': 'In Local Warehouse',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Delivered',
            'returned': 'Returned',
            'customs_hold': 'Customs Hold'
          };
          
          const newStatus = statusMap[input.scanType];
          if (newStatus) {
            await db.updatePackageStatusViaScan(
              input.packageId,
              newStatus,
              ctx.user.id,
              scan.id,
              {
                warehouseId: input.warehouseId,
                latitude: input.latitude,
                longitude: input.longitude
              }
            );
            
            // Send notification to customer if status is significant
            if (['received_local', 'delivered'].includes(input.scanType)) {
              const pkg = await db.getPackageById(input.packageId);
              if (pkg && pkg.customerId) {
                const customer = await db.getCustomerById(pkg.customerId);
                if (customer) {
                  const messages: Record<string, string> = {
                    'received_local': `پاکەتتان گەیشتە مەخزەنی هەولێر! کۆد: ${pkg.trackingNumber}`,
                    'delivered': `پاکەتتان گەیاندرا! سوپاس بۆ متمانەتان.`
                  };
                  appLogger.info("[SMS] Would send to customer", { mobileNumber: customer.mobileNumber, message: messages[input.scanType] });
                  // NOTE: Charging is handled at batch delivery (batches.router.ts)
                  // Scanning should NEVER charge customers to prevent double-charging
                  appLogger.info(`[Scan] ${input.scanType} scan for ${pkg.packageCode} - no charge (handled at batch delivery)`);
                }
              }
            }
          }
        }
        
        return scan;
      }),
    
    // Quick register package from scan (when package doesn't exist)
    quickRegisterPackage: staffProcedure
      .input(z.object({
        trackingNumber: z.string().min(1),
        customerId: z.number(),
        shippingType: z.enum(['air_regular', 'air_irregular', 'sea']).default('air_regular'),
        weight: z.number().optional(),
        dimensions: z.object({
          length: z.number(),
          width: z.number(),
          height: z.number(),
        }).optional(),
        goodsType: z.string().optional(),
        warehouseId: z.number().optional(),
        batchId: z.number().optional(),
        notes: z.string().optional(),
        photoUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Generate package code
        const packageCode = `PKG-${Date.now().toString(36).toUpperCase()}`;
        
        // Calculate CBM for sea shipments
        let volumeCbm: string | undefined;
        if (input.shippingType === 'sea' && input.dimensions) {
          const cbm = (input.dimensions.length * input.dimensions.width * input.dimensions.height) / 1000000;
          volumeCbm = cbm.toFixed(4);
        }
        
        // Calculate estimated price
        let estimatedPriceCalc: string | undefined;
        const pricingRules = await db.getAllPricingRules();
        const rule = pricingRules.find((r) => r.shippingType === input.shippingType && r.isActive);
        if (rule) {
          const pricePerUnit = parseFloat(rule.pricePerUnit || '0');
          if (rule.unit === 'cbm' && volumeCbm) {
            estimatedPriceCalc = (parseFloat(volumeCbm) * pricePerUnit).toFixed(2);
          } else if (rule.unit === 'kg' && input.weight) {
            estimatedPriceCalc = (input.weight * pricePerUnit).toFixed(2);
          }
        }
        
        // Create the package
        const pkg = await db.createPackage({
          packageCode,
          trackingNumber: input.trackingNumber,
          customerId: input.customerId,
          originWarehouseId: input.warehouseId || 1,
          shippingType: input.shippingType,
          weightKg: input.weight?.toString(),
          volumeCbm,
          lengthCm: input.dimensions?.length?.toString(),
          widthCm: input.dimensions?.width?.toString(),
          heightCm: input.dimensions?.height?.toString(),
          // estimatedPriceUsd: estimatedPriceCalc, // Field doesn't exist yet
          description: input.goodsType,
          status: 'registered',
          batchId: input.batchId,
          registeredById: ctx.user.id,
          notes: input.notes,
        });
        
        // Create initial scan
        await db.createPackageScan({
          trackingNumber: input.trackingNumber,
          packageId: pkg.id,
          scanType: 'registered',
          scannedById: ctx.user.id,
          warehouseId: input.warehouseId,
          photoUrl: input.photoUrl,
          notes: 'Quick registered via barcode scan',
        });
        
        // Create status history
        await db.createStatusHistory({
          packageId: pkg.id,
          fromStatus: null,
          toStatus: 'Registered',
          changedById: ctx.user.id,
          changeMethod: 'scan',
          reason: 'Initial registration via barcode scan',
        });
        
        return pkg;
      }),
    
    // Get my recent scans (for employee)
    myRecentScans: staffProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ input, ctx }) => {
        return db.getRecentScansByUser(ctx.user.id, input.limit);
      }),
    
    // Get today's scan statistics
    todayStats: staffProcedure
      .query(async ({ ctx }) => {
        const stats = await db.getTodayScanStats(ctx.user.id);
        return stats;
      }),

    // Scan analytics for dashboard
    scanAnalytics: staffProcedure
      .input(z.object({ days: z.number().default(7) }))
      .query(async ({ input }) => {
        const dailyScans = await db.getDailyScanCounts(input.days);
        const scansByType = await db.getScanCountsByType(input.days);
        const topScanners = await db.getTopScanners(input.days);
        return { dailyScans, scansByType, topScanners };
      }),
    
    // Get all today's scans for warehouse
    todayScans: staffProcedure
      .input(z.object({ warehouseId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getTodayScans(input.warehouseId);
      }),
    
    // Get package status history
    getStatusHistory: staffProcedure
      .input(z.object({ packageId: z.number() }))
      .query(async ({ input }) => {
        return db.getPackageStatusHistory(input.packageId);
      }),
    
    // Get packages missing info (for warehouse check)
    getMissingInfo: staffProcedure
      .query(async () => {
        return db.getPackagesMissingInfo();
      }),
    
    // Smart scan - auto-detect package type and return appropriate data
    smartScan: staffProcedure
      .input(z.object({ trackingNumber: z.string().min(1) }))
      .query(async ({ input }) => {
        const tracking = input.trackingNumber.trim();
        
        // First check Full Package Orders
        const fullPackageOrder = await db.getFullPackageOrderByTracking(tracking);
        if (fullPackageOrder) {
          const customer = await db.getCustomerById(fullPackageOrder.customerId);
          const scans = await db.getScansByTracking(tracking);
          return {
            found: true,
            type: 'full_package' as const,
            data: fullPackageOrder,
            customer,
            scans,
          };
        }
        
        // Then check regular Packages
        const packageResult = await db.getPackageWithCustomerByTracking(tracking);
        if (packageResult) {
          const scans = await db.getPackageScans(packageResult.package.id);
          const statusHistory = await db.getPackageStatusHistory(packageResult.package.id);
          return {
            found: true,
            type: 'package' as const,
            data: packageResult.package,
            customer: packageResult.customer,
            scans,
            statusHistory,
          };
        }
        
        // Not found - return empty for new registration
        return {
          found: false,
          type: 'new' as const,
          trackingNumber: tracking,
          data: null,
          customer: null,
          scans: [],
        };
      }),
    
    // Update package inline (for quick edits from scanner)
    updatePackageInline: staffProcedure
      .input(z.object({
        packageId: z.number(),
        status: z.string().optional(),
        weightKg: z.string().optional(),
        lengthCm: z.string().optional(),
        widthCm: z.string().optional(),
        heightCm: z.string().optional(),
        volumeCbm: z.string().optional(),
        notes: z.string().optional(),
        warehouseId: z.number().optional(),
        batchId: z.number().optional(), // For assigning package to batch during arrive
        shippingType: z.enum(['air_regular', 'air_irregular', 'sea']).optional(), // For updating shipping type
      }))
      .mutation(async ({ input, ctx }) => {
        const { packageId, status, batchId, shippingType, ...updateData } = input;
        
        // Update package fields including batchId and shippingType if provided
        const fieldsToUpdate = {
          ...updateData,
          ...(batchId !== undefined && { batchId }),
          ...(shippingType !== undefined && { shippingType }),
        };
        const updated = await db.updatePackageFields(packageId, fieldsToUpdate);
        
        // If status changed, create history and scan
        if (status) {
          const pkg = await db.getPackageById(packageId);
          if (pkg && pkg.status !== status) {
            await db.createStatusHistory({
              packageId,
              fromStatus: pkg.status,
              toStatus: status,
              changedById: ctx.user.id,
              changeMethod: 'scan',
              reason: 'Updated via warehouse operations',
            });
            
            await db.updatePackageStatus(packageId, status);
            
            // Create scan record
            const scanTypeMap: Record<string, string> = {
              'Registered': 'registered',
              'In China Warehouse': 'received_china',
              'In Batch': 'in_batch',
              'In Transit': 'in_transit',
              'In Local Warehouse': 'received_local',
              'Out for Delivery': 'out_for_delivery',
              'Delivered': 'delivered',
              'Returned': 'returned',
              'Customs Hold': 'customs_hold',
            };
            
            const scanType = (scanTypeMap[status] || 'registered') as 'registered' | 'received_china' | 'in_batch' | 'in_transit' | 'received_local' | 'out_for_delivery' | 'delivered' | 'returned' | 'customs_hold';
            await db.createPackageScan({
              trackingNumber: pkg.trackingNumber || '',
              packageId,
              scanType,
              scannedById: ctx.user.id,
              warehouseId: input.warehouseId,
              notes: `Status changed to ${status} via warehouse operations`,
            });
            
            // Send notification to customer about status change
            if (pkg.customerId && !pkg.isUnclaimed) {
              try {
                // Map warehouse operations status to notification status
                const notificationStatusMap: Record<string, string> = {
                  'Registered': 'registered',
                  'In China Warehouse': 'in_batch',
                  'In Batch': 'in_batch',
                  'In Transit': 'in_transit',
                  'In Local Warehouse': 'ready_for_delivery',
                  'Out for Delivery': 'out_for_delivery',
                  'Delivered': 'delivered',
                };
                const notificationStatus = notificationStatusMap[status];
                if (notificationStatus) {
                  await notifyPackageStatusChange(packageId, notificationStatus);
                }
              } catch (e) {
                appLogger.error('[Notification] Failed to send package status notification', { error: e instanceof Error ? e.message : String(e) });
              }
            }
            
            // NOTE: Charging is handled ONLY at batch delivery (batches.router.ts)
            // This prevents double-charging. Scans only update status.
            appLogger.info(`[Scan-Inline] Status updated to ${status} for package ${packageId} - no charge (handled at batch delivery)`);
          }
        }
        
        return updated;
      }),
    
    // Update full package order inline
    updateFullPackageInline: staffProcedure
      .input(z.object({
        orderId: z.number(),
        status: z.string().optional(),
        actualWeightKg: z.string().optional(),
        actualLengthCm: z.string().optional(),
        actualWidthCm: z.string().optional(),
        actualHeightCm: z.string().optional(),
        actualCbm: z.string().optional(),
        notes: z.string().optional(),
        warehouseId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { orderId, status, warehouseId, ...updateData } = input;
        
        // Update full package order (status from input may be string; API accepts union)
        const updatePayload = { ...updateData, ...(status !== undefined ? { status } : {}) };
        const updated = await db.updateFullPackageOrder(orderId, updatePayload as Parameters<typeof db.updateFullPackageOrder>[1], ctx.user.id);
        
        // If status changed, create scan record
        if (status && updated && updated.trackingNumber) {
          const scanTypeMap: Record<string, string> = {
            'pending': 'registered',
            'received_china': 'received_china',
            'in_batch': 'in_batch',
            'in_transit': 'in_transit',
            'arrived': 'received_local',
            'delivered': 'delivered',
            'cancelled': 'returned',
          };
          
          const scanType = (scanTypeMap[status] || 'registered') as 'registered' | 'received_china' | 'in_batch' | 'in_transit' | 'received_local' | 'out_for_delivery' | 'delivered' | 'returned' | 'customs_hold';
          await db.createPackageScan({
            trackingNumber: updated.trackingNumber,
            scanType,
            scannedById: ctx.user.id,
            warehouseId,
            notes: `Full package status changed to ${status} via smart scanner`,
          });
        }
        
        return updated;
      }),
    
    // AI-powered OCR for package labels
    aiOcr: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { performOCR } = await import('../services/ai.service');
        return performOCR(input.imageUrl);
      }),
    
    // AI-powered package image analysis
    aiAnalyzePackage: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { analyzePackageImage } = await import('../services/ai.service');
        return analyzePackageImage(input.imageUrl);
      }),
    
    // AI-powered full package info extraction
    aiExtractPackageInfo: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { extractPackageInfo } = await import('../services/ai.service');
        return extractPackageInfo(input.imageUrl);
      }),
    
    // AI-powered translation
    aiTranslate: staffProcedure
      .input(z.object({
        text: z.string(),
        targetLanguage: z.enum(['ku', 'ar', 'en']).default('ku')
      }))
      .mutation(async ({ input }) => {
        const { translateText } = await import('../services/ai.service');
        return translateText(input.text, input.targetLanguage);
      }),
    
    // Detect carrier from tracking number
    detectCarrier: staffProcedure
      .input(z.object({ trackingNumber: z.string() }))
      .query(async ({ input }) => {
        const { detectCarrier, validateTrackingNumber } = await import('../services/ai.service');
        const carrier = detectCarrier(input.trackingNumber);
        const validation = validateTrackingNumber(input.trackingNumber);
        return { carrier, validation };
      }),
    
    // Enhanced AI-powered package label scanning
    // Extracts customer code (AZ###), tracking number, product info
    aiScanLabel: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { scanPackageLabel } = await import('../services/ai.service');
        const scanResult = await scanPackageLabel(input.imageUrl);
        
        if (!scanResult.success) {
          return { success: false, error: scanResult.error };
        }
        
        // Try to find customer by code
        let customer = null;
        let existingPackage = null;
        
        // Get all customers for searching
        const customers = await db.getAllCustomers();
        
        // Try multiple search strategies
        if (scanResult.customerCode) {
          const codeToFind = scanResult.customerCode.toUpperCase();
          
          // 1. Exact match on customer code
          customer = customers.find((c) => 
            c.customerCode?.toUpperCase() === codeToFind
          );
          
          // 2. Partial match on customer code (contains)
          if (!customer) {
            customer = customers.find((c) => 
              c.customerCode?.toUpperCase().includes(codeToFind) ||
              codeToFind.includes(c.customerCode?.toUpperCase() || '')
            );
          }
        }
        
        // 3. Search by customer name if code didn't match
        if (!customer && scanResult.customerName) {
          const nameToFind = scanResult.customerName.toLowerCase();
          customer = customers.find((c) => 
            c.fullName?.toLowerCase().includes(nameToFind) ||
            nameToFind.includes(c.fullName?.toLowerCase() || '')
          );
        }
        
        // 4. Search by phone number if still not found
        if (!customer && scanResult.customerPhone) {
          const phoneToFind = scanResult.customerPhone.replace(/\D/g, '');
          customer = customers.find((c) => {
            const customerPhone = c.mobileNumber?.replace(/\D/g, '') || '';
            return customerPhone.includes(phoneToFind) || phoneToFind.includes(customerPhone);
          });
        }
        
        // Try to find existing package by tracking number
        if (scanResult.trackingNumber) {
          existingPackage = await db.searchPackageByTracking(scanResult.trackingNumber);
        }
        
        return {
          success: true,
          scanResult,
          customer: customer ? {
            id: customer.id,
            customerCode: customer.customerCode,
            name: customer.fullName || customer.customerCode,
            phone: customer.mobileNumber
          } : null,
          existingPackage: existingPackage ? {
            id: existingPackage.id,
            trackingNumber: existingPackage.trackingNumber,
            status: existingPackage.status,
            customerId: existingPackage.customerId,
            description: existingPackage.description
          } : null,
          action: existingPackage ? 'update_status' : 'register_new'
        };
      }),
    
    // Get customer by code for smart scanner
    findCustomerByCode: staffProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        const customers = await db.getAllCustomers();
        const normalizedCode = input.code.toUpperCase();
        
        // Find exact match first
        let customer = customers.find((c) => 
          c.customerCode?.toUpperCase() === normalizedCode
        );
        
        // If not found, try partial match
        if (!customer) {
          customer = customers.find((c) => 
            c.customerCode?.toUpperCase().includes(normalizedCode) ||
            normalizedCode.includes(c.customerCode?.toUpperCase() || '')
          );
        }
        
        if (!customer) return null;
        
        return {
          id: customer.id,
          customerCode: customer.customerCode,
          name: customer.fullName || customer.customerCode,
          phone: customer.mobileNumber,
          email: customer.email
        };
      }),
});

export const scanHistoryRouter = router({
    // Get scan history with filters
    list: staffProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        scanType: z.string().optional(),
        customerId: z.number().optional(),
        scannedById: z.number().optional(),
        status: z.string().optional(),
        trackingNumber: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return db.getScanHistory({
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          scanType: input.scanType,
          customerId: input.customerId,
          scannedById: input.scannedById,
          status: input.status,
          trackingNumber: input.trackingNumber,
          limit: input.limit,
          offset: input.offset,
        });
      }),
    
    // Get scan statistics for a date range
    statistics: staffProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getScanStatistics(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),
    
    // Get today's scan summary
    todaySummary: staffProcedure
      .input(z.object({ userId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getTodayScanSummary(input.userId);
      }),
    
    // Record a scan (called from WarehouseOperations)
    record: staffProcedure
      .input(z.object({
        packageId: z.number().optional(),
        fullPackageOrderId: z.number().optional(),
        trackingNumber: z.string(),
        scanType: z.enum(['register', 'receive', 'ship', 'arrive', 'deliver', 'return', 'other']),
        status: z.enum(['success', 'error', 'not_found']).default('success'),
        errorMessage: z.string().optional(),
        customerName: z.string().optional(),
        customerId: z.number().optional(),
        weightKg: z.number().optional(),
        shippingType: z.string().optional(),
        batchId: z.number().optional(),
        batchCode: z.string().optional(),
        calculatedCost: z.number().optional(),
        deviceType: z.string().optional(),
        warehouseId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createScanRecord({
          ...input,
          weightKg: input.weightKg?.toString(),
          calculatedCost: input.calculatedCost?.toString(),
          scannedById: ctx.user.id,
          scannedByName: ctx.user.name || 'Unknown',
        });
      }),
});

export const scanReportsRouter = router({
    // Get scans by date range
    getByDateRange: staffProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        scanType: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.getScansByDateRange(
          new Date(input.startDate),
          new Date(input.endDate),
          input.scanType
        );
      }),
    
    // Get scan statistics by date range
    getStatsByDateRange: staffProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getScanStatsByDateRange(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),
    
    // Get daily scan summary
    getDailySummary: staffProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ input }) => {
        return db.getDailyScanSummary(new Date(input.date));
      }),
    
    // Get monthly scan summary
    getMonthlySummary: staffProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ input }) => {
        return db.getMonthlyScanSummary(input.year, input.month);
      }),
    
    // Get scan totals by type
    getTotalsByType: staffProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getScanTotalsByType(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),
    
    // Get scans by employee
    getByEmployee: staffProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getScansByEmployee(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),
});

// ============ DELIVERY BOX ROUTER ============

export const deliveryBoxRouter = router({
  // Create a new delivery box for a customer
  create: staffProcedure
    .input(z.object({
      customerId: z.number(),
      deliveryMethod: z.enum(["warehouse_pickup", "home_delivery", "city_transfer"]).default("warehouse_pickup"),
      destinationCity: z.string().max(100).optional(),
      destinationAddress: z.string().max(2000).optional(),
      recipientName: z.string().max(255).optional(),
      recipientPhone: z.string().max(20).optional(),
      deliveryCostUsd: z.string().default("0"),
      deliveryChargeUsd: z.string().default("0"),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createDeliveryBox({
        ...input,
        createdById: ctx.user.id,
      });
    }),

  // Get box by ID with items
  getById: staffProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const box = await db.getDeliveryBoxById(input.id);
      if (!box) return null;
      const items = await db.getBoxItems(input.id);
      return { ...box, items };
    }),

  // Get open boxes (for current user or all)
  getOpenBoxes: staffProcedure
    .input(z.object({ myOnly: z.boolean().default(false) }).optional())
    .query(async ({ input, ctx }) => {
      return db.getOpenBoxes(input?.myOnly ? ctx.user.id : undefined);
    }),

  // List all boxes with filters
  list: staffProcedure
    .input(z.object({
      status: z.string().optional(),
      customerId: z.number().optional(),
      deliveryMethod: z.string().optional(),
      search: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
      // batchId: number = filter to a specific batch; null (via 0) = manual boxes only
      batchId: z.number().optional(),
      manualOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.getAllDeliveryBoxes({
        ...input,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
        batchId: input?.manualOnly ? null : input?.batchId,
      });
    }),

  // Update box details (cost, charge, destination, etc.)
  update: staffProcedure
    .input(z.object({
      id: z.number(),
      deliveryMethod: z.enum(["warehouse_pickup", "home_delivery", "city_transfer"]).optional(),
      destinationCity: z.string().max(100).optional(),
      destinationAddress: z.string().max(2000).optional(),
      recipientName: z.string().max(255).optional(),
      recipientPhone: z.string().max(20).optional(),
      deliveryCostUsd: z.string().optional(),
      deliveryChargeUsd: z.string().optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateDeliveryBox(id, data);
    }),

  // Scan a package into a box
  addItem: staffProcedure
    .input(z.object({
      boxId: z.number(),
      trackingNumber: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const box = await db.getDeliveryBoxById(input.boxId);
      if (!box) throw new TRPCError({ code: "NOT_FOUND", message: "بۆکس نەدۆزرایەوە" });
      if (box.status !== 'open') throw new TRPCError({ code: "BAD_REQUEST", message: "ئەم بۆکسە داخراوە، ناتوانرێت پاکەت زیاد بکرێت" });

      // Search package by tracking number
      const pkg = await db.getPackageByTrackingNumber(input.trackingNumber);
      const fpOrder = pkg ? null : await db.getFullPackageOrderByTrackingNumber(input.trackingNumber);

      if (!pkg && !fpOrder) {
        throw new TRPCError({ code: "NOT_FOUND", message: `پاکەت بە تراکینگ "${input.trackingNumber}" نەدۆزرایەوە` });
      }

      // Check ownership
      const itemCustomerId = pkg?.customerId || fpOrder?.customerId;
      if (itemCustomerId && itemCustomerId !== box.customerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ئەم پاکەتە بۆ کڕیارێکی تر تۆمارکراوە" });
      }

      // Check if already in a box
      if (pkg) {
        const check = await db.isPackageInAnyBox(pkg.id);
        if (check.inBox) throw new TRPCError({ code: "CONFLICT", message: `ئەم پاکەتە لە بۆکسی ${check.boxCode} دایە` });
      }
      if (fpOrder) {
        const check = await db.isFPOrderInAnyBox(fpOrder.id);
        if (check.inBox) throw new TRPCError({ code: "CONFLICT", message: `ئەم ئۆردەرە لە بۆکسی ${check.boxCode} دایە` });
      }

      // Labels for description breakdown. Per spec, commission orders roll
      // item price + commission into a single `t_itemPrice` total — no
      // separate commission line on box receipts.
      const t_itemPrice = 'نرخی بەرهەم';
      const t_shipping = 'نرخی گواستنەوە';

      // Chargeable weight = max(actual, volumetric). Box receipts must
      // surface the weight the customer is actually billed for, not the
      // raw scale reading. Volumetric divisor 6000 is the air-freight
      // industry standard (cm³ → kg).
      const computeChargeableKg = (
        actual: unknown,
        l: unknown,
        w: unknown,
        h: unknown,
      ): string => {
        const a = parseFloat(actual?.toString() || '0') || 0;
        const lN = parseFloat(l?.toString() || '0') || 0;
        const wN = parseFloat(w?.toString() || '0') || 0;
        const hN = parseFloat(h?.toString() || '0') || 0;
        const vol = (lN * wN * hN) / 6000;
        return Math.max(a, vol).toFixed(2);
      };

      // Determine item type, source, and CORRECT price per item type
      let itemType: 'regular' | 'full_package' | 'commission' = 'regular';
      let sourceInfo = '';
      let description = '';
      let weightKg = '0';
      let calculatedCostUsd = '0';

      if (pkg) {
        const batch = pkg.batchId ? await db.getBatchById(pkg.batchId) : null;
        sourceInfo = batch ? `باچ ${batch.batchCode}` : 'بێ باچ';
        description = pkg.description || pkg.trackingNumber || '';
        weightKg = computeChargeableKg(pkg.weightKg, pkg.lengthCm, pkg.widthCm, pkg.heightCm);

        // Recompute shipping cost FRESH from current measurements × batch
        // rate. `pkg.calculatedCostUsd` alone is unreliable: it is only
        // written by Phase 1 delivery and only when chargeable weight was
        // non-zero at that moment, so packages weighed/measured afterwards
        // keep a stale `0` and would price as $0 in the box.
        const chargeableKgNum = parseFloat(weightKg) || 0;
        const batchPricePerKg = parseFloat(batch?.pricePerKg?.toString() || '0') || 0;
        const batchPricePerCbm = parseFloat(batch?.pricePerCbm?.toString() || '0') || 0;
        const batchIsSea = batch?.shippingType === 'sea';
        let freshShippingCost = 0;
        if (batchIsSea && batchPricePerCbm > 0) {
          const pkgCbm = parseFloat((pkg as any).volumeCbm?.toString() || '0') || 0;
          freshShippingCost = pkgCbm * batchPricePerCbm;
        } else if (batchPricePerKg > 0) {
          freshShippingCost = chargeableKgNum * batchPricePerKg;
        }
        const persistedCost = parseFloat(pkg.calculatedCostUsd?.toString() || '0') || 0;
        const shippingCost = freshShippingCost > 0 ? freshShippingCost : persistedCost;
        calculatedCostUsd = shippingCost.toFixed(2);

        // Check if linked to FP order(s) — a single physical package can
        // fulfil multiple commission orders that share the carton (shared
        // trackings). The previous single-order lookup silently dropped
        // the siblings and understated the box total. Sum every linked
        // order so the receipt charges for everything that's actually in
        // the carton.
        if (pkg.trackingNumber) {
          const linkedOrders = await db.getAllOrdersByTrackingNumber(pkg.trackingNumber);
          if (linkedOrders.length > 0) {
            const isAnyCommission = linkedOrders.some(o => o.orderType === 'commission');
            itemType = isAnyCommission ? 'commission' : 'full_package';

            const orderCodes = linkedOrders.map(o => o.orderCode).join(' + ');
            const productNames = Array.from(new Set(linkedOrders.map(o => o.productName).filter(Boolean))).join(' + ');
            sourceInfo = `${orderCodes} - ${sourceInfo}`;
            description = productNames || description;

            // One physical package = one shipping fee, regardless of how
            // many orders share it.
            let goodsTotal = 0;
            for (const o of linkedOrders) {
              const qty = o.quantity || 1;
              if (o.orderType === 'commission') {
                const itemPrice = Number(o.itemPriceUsd || 0);
                const commFee = Number(o.commissionFeeUsd || o.commissionAmount || 0);
                goodsTotal += (itemPrice * qty) + commFee;
              } else {
                const sellingPrice = Number(o.sellingPriceUsd || 0);
                goodsTotal += sellingPrice * qty;
              }
            }

            if (isAnyCommission) {
              calculatedCostUsd = (goodsTotal + shippingCost).toFixed(2);
              const head = productNames || linkedOrders[0].productName || '';
              description = linkedOrders.length > 1
                ? `${head} (${linkedOrders.length} ئۆردەری هاوبەش) | ${t_itemPrice}: $${goodsTotal.toFixed(2)} + ${t_shipping}: $${shippingCost.toFixed(2)}`
                : `${head} | ${t_itemPrice}: $${goodsTotal.toFixed(2)} + ${t_shipping}: $${shippingCost.toFixed(2)}`;
            } else {
              calculatedCostUsd = goodsTotal.toFixed(2);
            }
          }
        }
      } else if (fpOrder) {
        itemType = fpOrder.orderType === 'commission' ? 'commission' : 'full_package';
        sourceInfo = fpOrder.orderCode;
        description = fpOrder.productName || '';
        weightKg = computeChargeableKg(
          fpOrder.weightKg,
          (fpOrder as any).dimensionLength,
          (fpOrder as any).dimensionWidth,
          (fpOrder as any).dimensionHeight,
        );

        if (fpOrder.orderType === 'commission') {
          // Commission: item price + commission fee combined into a single
          // total; no separate commission line on the box receipt.
          const itemPrice = Number(fpOrder.itemPriceUsd || 0);
          const commFee = Number(fpOrder.commissionFeeUsd || fpOrder.commissionAmount || 0);
          const qty = fpOrder.quantity || 1;
          const goodsTotal = (itemPrice * qty) + commFee;
          calculatedCostUsd = goodsTotal.toFixed(2);
          description = `${fpOrder.productName || ''} | ${t_itemPrice}: $${goodsTotal.toFixed(2)}`;
        } else {
          // Full Package: selling price × quantity
          const sellingPrice = Number(fpOrder.sellingPriceUsd || 0);
          const qty = fpOrder.quantity || 1;
          calculatedCostUsd = (sellingPrice * qty).toFixed(2);
        }
      }

      const item = await db.addItemToBox({
        boxId: input.boxId,
        packageId: pkg?.id || undefined,
        fullPackageOrderId: fpOrder?.id || undefined,
        trackingNumber: input.trackingNumber,
        packageCode: pkg?.packageCode || fpOrder?.orderCode || undefined,
        description,
        weightKg,
        calculatedCostUsd,
        itemType,
        sourceInfo,
        scannedById: ctx.user.id,
      });

      return { item, packageInfo: pkg || fpOrder };
    }),

  // Remove item from box
  removeItem: staffProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input }) => {
      await db.removeItemFromBox(input.itemId);
      return { success: true };
    }),

  // Get items in a box
  getItems: staffProcedure
    .input(z.object({ boxId: z.number() }))
    .query(async ({ input }) => {
      return db.getBoxItems(input.boxId);
    }),

  // Seal box (ready for shipping)
  seal: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const box = await db.getDeliveryBoxById(input.id);
      if (!box) throw new TRPCError({ code: "NOT_FOUND", message: "بۆکس نەدۆزرایەوە" });
      if (box.status !== 'open') throw new TRPCError({ code: "BAD_REQUEST", message: "تەنها بۆکسی کراوە داخرانی دەکرێت" });
      if (box.totalPackages === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "بۆکس خالییە — سەرەتا پاکەت زیاد بکە" });
      return db.sealBox(input.id, ctx.user.id);
    }),

  // Mark box as in-transit (charges customer wallet + creates invoice)
  markInTransit: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const box = await db.getDeliveryBoxById(input.id);
      if (!box) throw new TRPCError({ code: "NOT_FOUND", message: "بۆکس نەدۆزرایەوە" });
      if (box.status !== 'ready') throw new TRPCError({ code: "BAD_REQUEST", message: "سەرەتا بۆکسەکە داخە (seal)" });

      // Charge delivery fee to customer wallet
      const deliveryCharge = Number(box.deliveryChargeUsd || 0);
      if (deliveryCharge > 0 && !box.isCharged) {
        try {
          const customer = await db.getCustomerById(box.customerId);
          if (customer) {
            // Create invoice for delivery charge
            const items = await db.getBoxItems(box.id);
            const lineItems = [{
              description: `نرخی گەیاندنی بۆکس ${box.boxCode} (${items.length} پاکەت) - ${box.destinationCity || 'ناوخۆیی'}`,
              quantity: 1,
              unitPrice: deliveryCharge,
              total: deliveryCharge,
            }];
            const invoiceNumber = `INV-BOX-${Date.now()}-${box.id}`;
            const invoice = await db.createInvoice({
              invoiceNumber,
              customerId: box.customerId,
              subtotalUsd: deliveryCharge.toFixed(2),
              totalUsd: deliveryCharge.toFixed(2),
              status: "issued",
              issuedAt: new Date(),
              lineItems,
              notes: `پسووڵەی گەیاندنی بۆکس ${box.boxCode} بۆ ${box.destinationCity || 'ناوخۆیی'}`,
              createdById: ctx.user.id,
            });

            // Charge wallet
            await db.recordPackageChargeWithoutInvoice(
              box.customerId,
              customer.customerCode,
              0, // no specific package
              deliveryCharge,
              `نرخی گەیاندنی بۆکس ${box.boxCode}`,
              ctx.user.id,
              invoice.id
            );

            await db.updateDeliveryBox(box.id, {
              isCharged: true,
              invoiceId: invoice.id,
            });

            appLogger.info("[DeliveryBox] Charged customer for box delivery", { boxCode: box.boxCode, charge: deliveryCharge, customerId: box.customerId });
          }
        } catch (err) {
          appLogger.error("[DeliveryBox] Failed to charge delivery", { boxCode: box.boxCode, error: err instanceof Error ? err.message : String(err) });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "هەڵە لە charge کردنی والیت" });
        }
      }

      return db.markBoxInTransit(box.id, ctx.user.id);
    }),

  // Mark box as delivered
  markDelivered: staffProcedure
    .input(z.object({
      id: z.number(),
      signature: z.string().optional(),
      deliveryPhoto: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const box = await db.getDeliveryBoxById(input.id);
      if (!box) throw new TRPCError({ code: "NOT_FOUND", message: "بۆکس نەدۆزرایەوە" });
      if (box.status !== 'in_transit' && box.status !== 'ready') {
        throw new TRPCError({ code: "BAD_REQUEST", message: "بۆکس لە دۆخی گونجاو نییە" });
      }

      // Mark all packages in box as delivered
      const items = await db.getBoxItems(box.id);
      for (const item of items) {
        if (item.packageId) {
          try {
            await db.updatePackage(item.packageId, {
              status: 'delivered',
              deliveredAt: new Date(),
              deliveredById: ctx.user.id,
              recipientSignature: input.signature,
              deliveryPhoto: input.deliveryPhoto,
            });
          } catch (e) {
            appLogger.error("[DeliveryBox] Failed to update package status", { packageId: item.packageId, error: e instanceof Error ? e.message : String(e) });
          }
        }
        if (item.fullPackageOrderId) {
          try {
            await db.updateFullPackageOrder(item.fullPackageOrderId, {
              status: 'delivered',
              deliveredDate: new Date(),
              actualDeliveryDate: new Date(),
            }, ctx.user.id);
          } catch (e) {
            appLogger.error("[DeliveryBox] Failed to update FP order status", { fpOrderId: item.fullPackageOrderId, error: e instanceof Error ? e.message : String(e) });
          }
        }
      }

      return db.markBoxDelivered(box.id, ctx.user.id, input.signature, input.deliveryPhoto);
    }),

  // Cancel a box
  cancel: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const box = await db.getDeliveryBoxById(input.id);
      if (!box) throw new TRPCError({ code: "NOT_FOUND" });
      if (box.status === 'delivered') throw new TRPCError({ code: "BAD_REQUEST", message: "بۆکسی گەیاندراو هەڵناوەشێنرێتەوە" });
      return db.updateDeliveryBox(input.id, { status: 'cancelled' });
    }),

  // Profit report
  profitReport: accountantProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      return db.getDeliveryBoxProfitBreakdown(new Date(input.startDate), new Date(input.endDate));
    }),

  // Auto-create per-customer boxes for a batch
  createBoxesForBatch: staffProcedure
    .input(z.object({
      batchId: z.number(),
      deliveryMethod: z.enum(["warehouse_pickup", "home_delivery", "city_transfer"]).default("warehouse_pickup"),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createDeliveryBoxesForBatch(input.batchId, input.deliveryMethod, ctx.user.id);
    }),

  // Recompute every package-linked item for an existing box. Use this when
  // the batch has new packages added after the box was created, when batch
  // rates have changed, or when shared-tracking siblings were linked after
  // the original box build (the historical 1d11fa1 / "missing sibling
  // orders" bug). Refuses to run on delivered/cancelled boxes.
  recomputeItems: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return db.recomputeBoxItems(input.id, ctx.user.id);
    }),
});

export const scanningRouters = {
  qrCodes: qrCodesRouter,
  scanning: scanningRouter,
  scanHistory: scanHistoryRouter,
  scanReports: scanReportsRouter,
  deliveryBox: deliveryBoxRouter,
};
