import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';

describe('Advanced Features - Profit Reports & Notifications', () => {
  let testCustomerId: number;
  let testOrder1Id: number;
  let testOrder2Id: number;
  let testOrder3Id: number;

  beforeAll(async () => {
    // Get first customer
    const users = await db.getAllUsers();
    const customer = users.find(u => u.role === 'customer');
    if (!customer) {
      throw new Error('No customer found');
    }
    testCustomerId = customer.id;

    // Create test orders of different types
    const order1 = await db.createFullPackageOrder({
      orderCode: `FP-TEST1-${Date.now()}`,
      customerId: testCustomerId,
      orderType: 'full_package',
      productName: 'Test Full Package',
      quantity: 1,
      purchasePriceUsd: '50.00',
      sellingPriceUsd: '100.00',
      shippingCostUsd: '10.00',
      status: 'delivered',
      createdById: 1,
    });
    testOrder1Id = order1!.id;

    // Purchase Request now uses SAME formula as Full Package
    const order2 = await db.createFullPackageOrder({
      orderCode: `PR-TEST2-${Date.now()}`,
      customerId: testCustomerId,
      orderType: 'purchase_request',
      productName: 'Test Purchase Request',
      quantity: 1,
      purchasePriceUsd: '80.00', // Our cost
      sellingPriceUsd: '120.00', // Final price to customer
      shippingCostUsd: '15.00',
      status: 'delivered',
      createdById: 1,
    });
    testOrder2Id = order2!.id;

    const order3 = await db.createFullPackageOrder({
      orderCode: `COM-TEST3-${Date.now()}`,
      customerId: testCustomerId,
      orderType: 'commission',
      productName: 'Test Commission',
      quantity: 1,
      itemPriceUsd: '120.00',
      commissionFeeUsd: '12.00',
      shippingCostUsd: '20.00',
      status: 'delivered',
      createdById: 1,
    });
    testOrder3Id = order3!.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testOrder1Id) await db.deleteFullPackageOrder(testOrder1Id);
    if (testOrder2Id) await db.deleteFullPackageOrder(testOrder2Id);
    if (testOrder3Id) await db.deleteFullPackageOrder(testOrder3Id);
  });

  it('should generate profit report by order type', async () => {
    const report = await db.getFullPackageProfitSummaryByType();
    
    expect(report).toBeDefined();
    expect(report.byType).toBeDefined();
    expect(report.total).toBeDefined();
    
    // Check that we have data for each order type
    const fullPackageData = report.byType.find(t => t.orderType === 'full_package');
    const purchaseRequestData = report.byType.find(t => t.orderType === 'purchase_request');
    const commissionData = report.byType.find(t => t.orderType === 'commission');
    
    expect(fullPackageData).toBeDefined();
    expect(purchaseRequestData).toBeDefined();
    expect(commissionData).toBeDefined();
    
    // Verify totals are calculated correctly
    expect(report.total.totalOrders).toBeGreaterThan(0);
    expect(report.total.totalRevenue).toBeGreaterThan(0);
  });

  it('should send notification when shipping cost is added', async () => {
    // Create a new order and package
    const tracking = `TEST-NOTIFY-${Date.now()}`;
    const order = await db.createFullPackageOrder({
      orderCode: `FP-NOTIFY-${Date.now()}`,
      customerId: testCustomerId,
      orderType: 'full_package',
      productName: 'Test Notification',
      quantity: 1,
      purchasePriceUsd: '30.00',
      sellingPriceUsd: '60.00',
      status: 'ordered',
      trackingNumber: tracking,
      createdById: 1,
    });

    const warehouse = await db.getAllWarehouses();
    const pkg = await db.createPackage({
      packageCode: `PKG-NOTIFY-${Date.now()}`,
      customerId: testCustomerId,
      trackingNumber: tracking,
      originWarehouseId: warehouse[0]?.id || 1,
      shippingType: 'air_regular',
      weightKg: '2.0',
      status: 'registered',
      createdById: 1,
      registeredById: 1,
    });

    // Get notification count before
    const notificationsBefore = await db.getCustomerNotifications(testCustomerId);
    const countBefore = notificationsBefore.length;

    // Update package to delivered with shipping cost
    await db.updatePackage(pkg!.id, {
      status: 'delivered',
      calculatedCostUsd: '18.50',
      isCharged: true,
    });

    // Wait for async notification
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check notification was created
    const notificationsAfter = await db.getCustomerNotifications(testCustomerId);
    const countAfter = notificationsAfter.length;

    expect(countAfter).toBeGreaterThan(countBefore);

    // Find the shipping cost notification
    const shippingNotification = notificationsAfter.find(
      n => n.relatedType === 'full_package' && n.relatedId === order!.id
    );

    expect(shippingNotification).toBeDefined();
    expect(shippingNotification?.type).toBe('package');
    expect(shippingNotification?.message).toContain('$18.5');

    // Cleanup
    await db.deletePackage(pkg!.id);
    await db.deleteFullPackageOrder(order!.id);
  });

  it('should calculate profit correctly for different order types', async () => {
    // UNIFIED FINANCIAL MODEL:
    // Full Package & Purchase Request: profit = (selling - purchase) * quantity - shipping
    // Commission: profit = commissionFee - shipping
    
    // Full package: profit = (100 - 50) * 1 - 10 = 40
    const order1 = await db.getFullPackageOrderById(testOrder1Id);
    const expectedProfit1 = (100 - 50) * 1 - 10; // = 40
    expect(parseFloat(order1?.profitUsd || '0')).toBe(expectedProfit1);

    // Purchase request: profit = (120 - 80) * 1 - 15 = 25 (same formula as Full Package)
    const order2 = await db.getFullPackageOrderById(testOrder2Id);
    const expectedProfit2 = (120 - 80) * 1 - 15; // = 25
    expect(parseFloat(order2?.profitUsd || '0')).toBe(expectedProfit2);

    // Commission: profit = commissionFee - shipping = 12 - 20 = -8
    const order3 = await db.getFullPackageOrderById(testOrder3Id);
    const expectedProfit3 = 12 - 20; // = -8 (loss because shipping > commission)
    expect(parseFloat(order3?.profitUsd || '0')).toBe(expectedProfit3);
  });

  it('should group profit report correctly by order type', async () => {
    const report = await db.getFullPackageProfitSummaryByType();
    
    // Verify each type has correct calculations
    for (const typeData of report.byType) {
      expect(typeData.orderType).toMatch(/full_package|purchase_request|commission/);
      expect(Number(typeData.totalOrders)).toBeGreaterThanOrEqual(0);
      expect(Number(typeData.totalRevenue)).toBeGreaterThanOrEqual(0);
      expect(Number(typeData.totalCost)).toBeGreaterThanOrEqual(0);
    }

    // Verify total is sum of all types
    const sumOrders = report.byType.reduce((sum, t) => sum + parseFloat(t.totalOrders?.toString() || '0'), 0);
    expect(Math.abs(report.total.totalOrders - sumOrders)).toBeLessThan(0.01);
  });
});
