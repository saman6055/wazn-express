import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { notifyPackageStatusChange } from "../notifications";
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
                  console.log(`[SMS] Would send to ${customer.mobileNumber}: ${messages[input.scanType]}`);
                  
                  // Charge customer and create invoice when package arrives locally or is delivered
                  if (!pkg.isCharged) {
                    try {
                      // Get pricing
                      // Get batch pricing first, then check for customer-specific pricing
                      let pricePerKg = 15; // Default
                      let pricePerCbm = 100; // Default
                      
                      if (pkg.batchId) {
                        const batch = await db.getBatchById(pkg.batchId);
                        if (batch) {
                          // Check for customer-specific pricing
                          const customerPricing = await db.getCustomerPricingInBatch(pkg.batchId, pkg.customerId!);
                          if (customerPricing) {
                            pricePerKg = parseFloat(customerPricing.pricePerKg || '0');
                            pricePerCbm = parseFloat(customerPricing.pricePerCbm || '0');
                          } else {
                            pricePerKg = parseFloat(batch.pricePerKg || '0');
                            pricePerCbm = parseFloat(batch.pricePerCbm || '0');
                          }
                        }
                      }
                      // Determine pricing based on shipping type
                      const isSea = pkg.shippingType === 'sea';
                      const pricePerUnit = isSea ? pricePerCbm : pricePerKg;
                      const unit = isSea ? 'cbm' : 'kg';
                      const quantity = isSea ? parseFloat(pkg.volumeCbm || '0') : parseFloat(pkg.weightKg || '0');
                      
                      const chargeAmount = quantity * pricePerUnit;
                      
                      if (chargeAmount > 0) {
                        console.log(`[Scan] Charging customer ${customer.customerCode} for package ${pkg.packageCode}: $${chargeAmount}`);
                        
                        // Use unified applyCharge function
                        await db.applyCharge(
                          pkg.customerId!,
                          customer.customerCode,
                          'PACKAGE',
                          pkg.id,
                          chargeAmount,
                          `Package charge - ${pkg.packageCode} (${quantity}${unit} × $${pricePerUnit}/${unit})`,
                          ctx.user.id
                        );
                        
                        // Mark package as charged
                        await db.updatePackage(pkg.id, {
                          isCharged: true,
                          calculatedCostUsd: chargeAmount.toFixed(2),
                        });
                        
                        // Create revenue record
                        await db.createRevenueRecord({
                          recordDate: new Date(),
                          revenueType: 'package_delivery',
                          referenceType: 'package',
                          referenceId: pkg.id,
                          customerId: pkg.customerId,
                          amountUsd: chargeAmount,
                          description: `Package ${input.scanType === 'delivered' ? 'delivery' : 'arrival'} - ${pkg.packageCode}`,
                          createdById: ctx.user.id,
                        });
                        
                        // Update daily financial summary
                        await db.updateDailyFinancialSummary(new Date(), { addRevenue: chargeAmount, revenueType: 'package_delivery' });
                        
                        // Invoice is created at batch arrival, not individual delivery
                        // This prevents duplicate invoices
                        console.log(`[Scan] Package ${pkg.packageCode} charged - invoice already created at batch arrival`);
                      }
                    } catch (e) {
                      console.error('[Scan] Failed to charge customer:', e);
                    }
                  }
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
        const rule = pricingRules.find((r: any) => r.shippingType === input.shippingType && r.isActive);
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
        applyCharge: z.boolean().optional(), // For arrive workflow - calculate and charge price
        batchId: z.number().optional(), // For assigning package to batch during arrive
        shippingType: z.enum(['air_regular', 'air_irregular', 'sea']).optional(), // For updating shipping type
      }))
      .mutation(async ({ input, ctx }) => {
        const { packageId, status, applyCharge, batchId, shippingType, ...updateData } = input;
        
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
                console.error('[Notification] Failed to send package status notification:', e);
              }
            }
            
            // Apply charge on arrival (ready_for_delivery) if not already charged
            if ((status === 'ready_for_delivery' || applyCharge) && !pkg.isCharged && pkg.customerId && !pkg.isUnclaimed) {
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
                  
                  // Check for customer-specific pricing (takes priority over batch default)
                  if (pricePerUnit === 0) {
                    const customerPricing = await db.getCustomerPricingInBatch(pkg.batchId, pkg.customerId);
                    if (customerPricing) {
                      pricePerUnit = unit === 'cbm'
                        ? Number(customerPricing.pricePerCbm) || 0
                        : Number(customerPricing.pricePerKg) || 0;
                      if (pricePerUnit > 0) {
                        pricingSource = 'customer_specific';
                      }
                    }
                  }
                  
                  // If no customer-specific price, use batch default price
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
                // Use unified applyCharge function - use chargeable weight for kg unit
                let quantity: string | null;
                if (unit === 'cbm') {
                  quantity = pkg.volumeCbm;
                } else {
                  // Calculate chargeable weight for description
                  const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                  const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                  const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                  const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                  const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                  const chargeableKg = Math.max(actualKg, volumetricKg);
                  quantity = chargeableKg.toFixed(2);
                }
                const customerForCharge = await db.getCustomerById(pkg.customerId);
                if (customerForCharge) {
                  await db.applyCharge(
                    pkg.customerId,
                    customerForCharge.customerCode,
                    'PACKAGE',
                    pkg.id,
                    chargeAmount,
                    `Arrival charge - Package ${pkg.packageCode} (${quantity}${unit} × $${pricePerUnit}/${unit})`,
                    ctx.user.id
                  );
                }
                
                // Mark package as charged
                await db.updatePackage(pkg.id, {
                  isCharged: true,
                  calculatedCostUsd: chargeAmount.toFixed(2),
                });
                
                // Create revenue record for finance tracking
                try {
                  await db.createRevenueRecord({
                    recordDate: new Date(),
                    revenueType: 'package_delivery',
                    referenceType: 'package',
                    referenceId: pkg.id,
                    customerId: pkg.customerId,
                    amountUsd: chargeAmount,
                    description: `Package arrival - ${pkg.packageCode}`,
                    createdById: ctx.user.id,
                  });
                  
                  // Update daily financial summary
                  await db.updateDailyFinancialSummary(new Date(), { addRevenue: chargeAmount, revenueType: 'package_delivery' });
                } catch (e) {
                  console.error('[Finance] Failed to create revenue record:', e);
                }
                
                // Create ledger transaction for new accounting system
                try {
                  const customer = await db.getCustomerById(pkg.customerId);
                  if (customer) {
                    await db.recordPackageCharge(
                      pkg.customerId,
                      customer.customerCode,
                      pkg.id,
                      chargeAmount,
                      `Arrival charge - Package ${pkg.packageCode} (${quantity}${unit} × $${pricePerUnit}/${unit})`,
                      ctx.user.id
                    );
                  }
                } catch (e) {
                  console.error('[Ledger] Failed to create ledger transaction:', e);
                }
                
                // Invoice is created at batch arrival, not individual package update
                // This prevents duplicate invoices
                console.log('[Invoice-WH] Package charged - invoice already created at batch arrival');
                
                return { ...updated, chargedAmount: chargeAmount.toFixed(2), pricingSource };
              }
            }
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
        
        // Update full package order
        const updated = await db.updateFullPackageOrder(orderId, {
          ...updateData,
          status: status as any,
        }, ctx.user.id);
        
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
        const { performOCR } = await import('../aiService');
        return performOCR(input.imageUrl);
      }),
    
    // AI-powered package image analysis
    aiAnalyzePackage: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { analyzePackageImage } = await import('../aiService');
        return analyzePackageImage(input.imageUrl);
      }),
    
    // AI-powered full package info extraction
    aiExtractPackageInfo: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { extractPackageInfo } = await import('../aiService');
        return extractPackageInfo(input.imageUrl);
      }),
    
    // AI-powered translation
    aiTranslate: staffProcedure
      .input(z.object({
        text: z.string(),
        targetLanguage: z.enum(['ku', 'ar', 'en']).default('ku')
      }))
      .mutation(async ({ input }) => {
        const { translateText } = await import('../aiService');
        return translateText(input.text, input.targetLanguage);
      }),
    
    // Detect carrier from tracking number
    detectCarrier: staffProcedure
      .input(z.object({ trackingNumber: z.string() }))
      .query(async ({ input }) => {
        const { detectCarrier, validateTrackingNumber } = await import('../aiService');
        const carrier = detectCarrier(input.trackingNumber);
        const validation = validateTrackingNumber(input.trackingNumber);
        return { carrier, validation };
      }),
    
    // Enhanced AI-powered package label scanning
    // Extracts customer code (AZ###), tracking number, product info
    aiScanLabel: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { scanPackageLabel } = await import('../aiService');
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
          customer = customers.find((c: any) => 
            c.customerCode?.toUpperCase() === codeToFind
          );
          
          // 2. Partial match on customer code (contains)
          if (!customer) {
            customer = customers.find((c: any) => 
              c.customerCode?.toUpperCase().includes(codeToFind) ||
              codeToFind.includes(c.customerCode?.toUpperCase() || '')
            );
          }
        }
        
        // 3. Search by customer name if code didn't match
        if (!customer && scanResult.customerName) {
          const nameToFind = scanResult.customerName.toLowerCase();
          customer = customers.find((c: any) => 
            c.fullName?.toLowerCase().includes(nameToFind) ||
            nameToFind.includes(c.fullName?.toLowerCase() || '')
          );
        }
        
        // 4. Search by phone number if still not found
        if (!customer && scanResult.customerPhone) {
          const phoneToFind = scanResult.customerPhone.replace(/\D/g, '');
          customer = customers.find((c: any) => {
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
        let customer = customers.find((c: any) => 
          c.customerCode?.toUpperCase() === normalizedCode
        );
        
        // If not found, try partial match
        if (!customer) {
          customer = customers.find((c: any) => 
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

export const scanningRouters = {
  qrCodes: qrCodesRouter,
  scanning: scanningRouter,
  scanHistory: scanHistoryRouter,
  scanReports: scanReportsRouter,
};
