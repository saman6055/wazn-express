/**
 * Full Package Linked Package Shipping Test
 * 
 * Tests that when a package is linked to a Full Package order:
 * 1. Shipping cost is NOT charged to customer
 * 2. Shipping cost is added to Full Package as OUR cost
 * 3. Profit is recalculated: profit = sellingPrice - purchasePrice - shippingCost
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())('Full Package Linked Package Shipping', () => {
  let testCustomerId: number;
  let testCustomerCode: string;
  let testFullPackageOrderId: number;
  let testPackageId: number;
  
  beforeAll(async () => {
    // Use existing customer
    const customers = await db.getAllCustomers();
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
      testCustomerCode = customers[0].customerCode;
    } else {
      throw new Error('No customers found in database for testing');
    }
  });
  
  afterAll(async () => {
    // Cleanup
    if (testPackageId) {
      try { await db.deletePackage(testPackageId); } catch (e) {}
    }
    if (testFullPackageOrderId) {
      try { await db.deleteFullPackageOrder(testFullPackageOrderId); } catch (e) {}
    }
  });
  
  it('should NOT charge shipping to customer when package is linked to Full Package', async () => {
    // Create Full Package order with tracking number
    const trackingNumber = 'FP-SHIP-TEST-' + Date.now();
    const fpOrder = await db.createFullPackageOrder({
      orderCode: 'FP-SHIP-' + Date.now(),
      customerId: testCustomerId,
      orderType: 'full_package',
      productName: 'Shipping Test Product',
      quantity: 1,
      purchasePriceUsd: '10.00', // Our purchase cost
      sellingPriceUsd: '50.00', // Final price to customer
      trackingNumber: trackingNumber,
      status: 'ordered',
      createdById: 1
    });
    testFullPackageOrderId = fpOrder.id;
    
    // Verify initial profit (no shipping yet)
    expect(fpOrder.profitUsd).toBe('40.00'); // 50 - 10 - 0 = 40
    
    // Get customer balance before
    const balanceBefore = await db.getCustomerBalance(testCustomerId);
    
    // Create package with same tracking number (linked to Full Package)
    const warehouses = await db.getAllWarehouses();
    const pkg = await db.createPackage({
      trackingNumber: trackingNumber,
      packageCode: 'PKG-' + Date.now(),
      customerId: testCustomerId,
      status: 'registered',
      originWarehouseId: warehouses[0]?.id || 1,
      shippingType: 'air_regular',
      weightKg: '2.00',
      registeredById: 1
    });
    testPackageId = pkg.id;
    
    // Verify package is linked to Full Package
    const linkedFP = await db.getFullPackageOrderByTrackingNumber(trackingNumber);
    expect(linkedFP).toBeDefined();
    expect(linkedFP?.id).toBe(testFullPackageOrderId);
    
    // Simulate shipping cost calculation (normally done by batch pricing)
    // For this test, we'll manually set the shipping cost
    const shippingCost = 24.00;
    
    // Update Full Package with shipping cost (as would happen on delivery)
    await db.updateFullPackageOrder(testFullPackageOrderId, {
      shippingCostUsd: shippingCost.toFixed(2),
      status: 'delivered'
    }, 1);
    
    // Get updated Full Package
    const updatedFP = await db.getFullPackageOrderById(testFullPackageOrderId);
    
    // Verify shipping cost is recorded
    expect(updatedFP?.shippingCostUsd).toBe('24.00');
    
    // Verify profit is recalculated: 50 - 10 - 24 = 16
    expect(updatedFP?.profitUsd).toBe('16.00');
    
    // Get customer balance after
    const balanceAfter = await db.getCustomerBalance(testCustomerId);
    
    // Customer should be charged ONLY $50 (sellingPrice), NOT $50 + $24
    const chargeAmount = balanceAfter - balanceBefore;
    expect(chargeAmount).toBe(50); // Only selling price, not shipping
    
    console.log(`
    TEST SUMMARY:
    - Purchase Price: $10.00
    - Selling Price: $50.00
    - Shipping Cost: $24.00 (OUR cost)
    - Profit: $16.00 (50 - 10 - 24)
    - Customer Charged: $${chargeAmount} (only selling price)
    `);
  });
  
  it('should correctly calculate profit with shipping cost', async () => {
    // Test the profit formula: profit = (sellingPrice - purchasePrice) * quantity - shippingCost
    const testCases = [
      { purchase: 10, selling: 50, shipping: 20, quantity: 1, expectedProfit: 20 },
      { purchase: 25, selling: 100, shipping: 15, quantity: 1, expectedProfit: 60 },
      { purchase: 50, selling: 80, shipping: 30, quantity: 2, expectedProfit: 30 }, // (80-50)*2 - 30 = 30
    ];
    
    for (const tc of testCases) {
      const order = await db.createFullPackageOrder({
        orderCode: 'FP-CALC-' + Date.now() + '-' + Math.random(),
        customerId: testCustomerId,
        orderType: 'full_package',
        productName: 'Profit Calc Test',
        quantity: tc.quantity,
        purchasePriceUsd: tc.purchase.toFixed(2),
        sellingPriceUsd: tc.selling.toFixed(2),
        shippingCostUsd: tc.shipping.toFixed(2),
        createdById: 1
      });
      
      expect(parseFloat(order.profitUsd || '0')).toBe(tc.expectedProfit);
      
      // Cleanup
      await db.deleteFullPackageOrder(order.id);
    }
  });
});
