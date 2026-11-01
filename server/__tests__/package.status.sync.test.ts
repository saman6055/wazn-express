import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())('Package Status Sync to FullPackageOrder', () => {
  let testCustomerId: number;
  let testPackageId: number;
  let testFullPackageOrderId: number;
  const testTrackingNumber = `TEST-SYNC-${Date.now()}`;

  beforeAll(async () => {
    // Get first customer from database
    const users = await db.getAllUsers();
    const customer = users.find(u => u.role === 'customer');
    if (!customer) {
      throw new Error('No customer found in database. Please create a customer first.');
    }
    testCustomerId = customer.id;

    // Create test fullPackageOrder with tracking number
    const order = await db.createFullPackageOrder({
      orderCode: `FP-SYNC-${Date.now()}`,
      customerId: testCustomerId,
      orderType: 'full_package',
      productName: 'Test Sync Product',
      quantity: 1,
      purchasePriceUsd: '50.00',
      sellingPriceUsd: '100.00',
      shippingCostUsd: '0.00',
      status: 'ordered',
      trackingNumber: testTrackingNumber,
      createdById: 1,
    });
    testFullPackageOrderId = order!.id;

    // Create test package with same tracking number
    const warehouse = await db.getAllWarehouses();
    const pkg = await db.createPackage({
      packageCode: `PKG-SYNC-${Date.now()}`,
      customerId: testCustomerId,
      trackingNumber: testTrackingNumber,
      originWarehouseId: warehouse[0]?.id || 1,
      shippingType: 'air_regular',
      weightKg: '2.5',
      status: 'registered',
      isUnclaimed: false,
      createdById: 1,
      registeredById: 1,
    });
    testPackageId = pkg!.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testPackageId) await db.deletePackage(testPackageId);
    if (testFullPackageOrderId) await db.deleteFullPackageOrder(testFullPackageOrderId);
  });

  it('should sync status from package to fullPackageOrder when status changes', async () => {
    // Update package status to "in_batch"
    await db.updatePackage(testPackageId, { status: 'in_batch' });

    // Check if fullPackageOrder status was synced to "in_transit"
    const order = await db.getFullPackageOrderById(testFullPackageOrderId);
    expect(order?.status).toBe('in_transit');
  });

  it('should update shipping cost and recalculate profit when package is delivered', async () => {
    // Set calculated cost on package and mark as delivered
    await db.updatePackage(testPackageId, {
      status: 'delivered',
      calculatedCostUsd: '25.00',
      isCharged: true,
    });

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if fullPackageOrder was updated
    const order = await db.getFullPackageOrderById(testFullPackageOrderId);
    expect(order?.status).toBe('delivered');
    expect(order?.shippingCostUsd).toBe('25.00');
    
    // Profit should be: (100 - 50) * 1 - 25 = 25
    const profit = parseFloat(order?.profitUsd || '0');
    expect(profit).toBe(25);
  });

  it('should map package statuses correctly to fullPackageOrder statuses', async () => {
    // Test different status mappings
    const statusMappings = [
      { packageStatus: 'registered', expectedOrderStatus: 'ordered' },
      { packageStatus: 'in_transit', expectedOrderStatus: 'in_transit' },
      { packageStatus: 'ready_for_delivery', expectedOrderStatus: 'arrived' },
      { packageStatus: 'out_for_delivery', expectedOrderStatus: 'arrived' },
    ];

    for (const mapping of statusMappings) {
      const tracking = `TEST-MAP-${Date.now()}-${Math.random()}`;
      
      const order = await db.createFullPackageOrder({
        orderCode: `FP-MAP-${Date.now()}-${Math.random()}`,
        customerId: testCustomerId,
        orderType: 'full_package',
        productName: 'Test Status Mapping',
        quantity: 1,
        purchasePriceUsd: '10.00',
        sellingPriceUsd: '20.00',
        status: 'ordered',
        trackingNumber: tracking,
        createdById: 1,
      });

      const warehouse = await db.getAllWarehouses();
      const pkg = await db.createPackage({
        packageCode: `PKG-MAP-${Date.now()}-${Math.random()}`,
        customerId: testCustomerId,
        trackingNumber: tracking,
        originWarehouseId: warehouse[0]?.id || 1,
        shippingType: 'air_regular',
        weightKg: '1.0',
        status: 'registered',
        createdById: 1,
        registeredById: 1,
      });

      // Update package status
      await db.updatePackage(pkg!.id, { status: mapping.packageStatus as any });

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check order status
      const updatedOrder = await db.getFullPackageOrderById(order!.id);
      expect(updatedOrder?.status).toBe(mapping.expectedOrderStatus);

      // Cleanup
      await db.deletePackage(pkg!.id);
      await db.deleteFullPackageOrder(order!.id);
    }
  });

  it('should not sync if package has no tracking number', async () => {
    // Create order with tracking
    const tracking = `TEST-NOSYNC-${Date.now()}`;
    const order = await db.createFullPackageOrder({
      orderCode: `FP-NOSYNC-${Date.now()}`,
      customerId: testCustomerId,
      orderType: 'full_package',
      productName: 'Test No Sync',
      quantity: 1,
      purchasePriceUsd: '10.00',
      sellingPriceUsd: '20.00',
      status: 'ordered',
      trackingNumber: tracking,
      createdById: 1,
    });

    // Create package WITHOUT tracking number
    const warehouse = await db.getAllWarehouses();
    const pkg = await db.createPackage({
      packageCode: `PKG-NOSYNC-${Date.now()}`,
      customerId: testCustomerId,
      originWarehouseId: warehouse[0]?.id || 1,
      shippingType: 'air_regular',
      weightKg: '1.0',
      status: 'registered',
      createdById: 1,
      registeredById: 1,
    });

    // Update package status
    await db.updatePackage(pkg!.id, { status: 'delivered' });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 50));

    // Order status should NOT change
    const updatedOrder = await db.getFullPackageOrderById(order!.id);
    expect(updatedOrder?.status).toBe('ordered');

    // Cleanup
    await db.deletePackage(pkg!.id);
    await db.deleteFullPackageOrder(order!.id);
  });
});
