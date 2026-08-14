/**
 * Profit Calculation Formula Tests
 * 
 * UNIFIED FINANCIAL MODEL:
 * - Full Package & Purchase Request: profit = (sellingPrice - purchasePrice) * quantity - shippingCost
 * - Commission: profit = commissionFee - shippingCost
 * - Customer pays sellingPriceUsd (final price) ONLY, shipping is our cost
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())('Profit Calculation Formulas', () => {
  let testCustomerId: number;
  const createdOrderIds: number[] = [];

  beforeAll(async () => {
    // Use existing customer
    const customers = await db.getAllCustomers();
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
    } else {
      throw new Error('No customers found in database for testing');
    }
  });

  afterAll(async () => {
    // Cleanup
    for (const orderId of createdOrderIds) {
      try {
        await db.deleteFullPackageOrder(orderId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  it('should calculate profit for Full Package: (sellingPrice - purchasePrice) * quantity - shippingCost', async () => {
    // Create test order
    const order = await db.createFullPackageOrder({
      orderCode: 'FP-PROFIT-TEST-' + Date.now(),
      customerId: testCustomerId,
      orderType: 'full_package',
      productName: 'Full Package Profit Test',
      quantity: 2,
      purchasePriceUsd: '50.00',
      sellingPriceUsd: '100.00',
      shippingCostUsd: '25.00',
      createdById: 1
    });
    
    createdOrderIds.push(order.id);

    expect(order).toBeDefined();
    expect(order.orderType).toBe('full_package');

    // Expected: (100 - 50) * 2 - 25 = 75
    const purchasePrice = parseFloat(order.purchasePriceUsd || '0');
    const sellingPrice = parseFloat(order.sellingPriceUsd || '0');
    const quantity = order.quantity || 1;
    const shippingCost = parseFloat(order.shippingCostUsd || '0');
    const expectedProfit = ((sellingPrice - purchasePrice) * quantity) - shippingCost;

    expect(purchasePrice).toBe(50);
    expect(sellingPrice).toBe(100);
    expect(quantity).toBe(2);
    expect(shippingCost).toBe(25);
    expect(parseFloat(order.profitUsd || '0')).toBe(expectedProfit);
    expect(expectedProfit).toBe(75);
  });

  it('should calculate profit for Purchase Request: (sellingPrice - purchasePrice) * quantity - shippingCost', async () => {
    // Create test order - Purchase Request now uses SAME formula as Full Package
    const order = await db.createFullPackageOrder({
      orderCode: 'PR-PROFIT-TEST-' + Date.now(),
      customerId: testCustomerId,
      orderType: 'purchase_request',
      productName: 'Purchase Request Profit Test',
      quantity: 1,
      purchasePriceUsd: '10.00', // Our purchase cost
      sellingPriceUsd: '25.00', // Final price to customer
      shippingCostUsd: '5.00',
      createdById: 1
    });
    
    createdOrderIds.push(order.id);

    expect(order).toBeDefined();
    expect(order.orderType).toBe('purchase_request');

    // Expected: (25 - 10) * 1 - 5 = 10
    const purchasePrice = parseFloat(order.purchasePriceUsd || '0');
    const sellingPrice = parseFloat(order.sellingPriceUsd || '0');
    const quantity = order.quantity || 1;
    const shippingCost = parseFloat(order.shippingCostUsd || '0');
    const expectedProfit = ((sellingPrice - purchasePrice) * quantity) - shippingCost;

    expect(purchasePrice).toBe(10);
    expect(sellingPrice).toBe(25);
    expect(quantity).toBe(1);
    expect(shippingCost).toBe(5);
    expect(parseFloat(order.profitUsd || '0')).toBe(expectedProfit);
    expect(expectedProfit).toBe(10);
  });

  it('should calculate profit for Commission: commissionFee - shippingCost', async () => {
    // Create test order
    const order = await db.createFullPackageOrder({
      orderCode: 'COM-PROFIT-TEST-' + Date.now(),
      customerId: testCustomerId,
      orderType: 'commission',
      productName: 'Commission Profit Test',
      quantity: 1,
      itemPriceUsd: '100.00', // Customer knows the price
      commissionFeeUsd: '8.00', // Our commission
      shippingCostUsd: '5.00', // Our shipping cost
      createdById: 1
    });
    
    createdOrderIds.push(order.id);

    expect(order).toBeDefined();
    expect(order.orderType).toBe('commission');

    // Expected: 8 - 5 = 3 (commission minus shipping)
    const commissionFee = parseFloat(order.commissionFeeUsd || '0');
    const shippingCost = parseFloat(order.shippingCostUsd || '0');
    const expectedProfit = commissionFee - shippingCost;

    expect(commissionFee).toBe(8);
    expect(shippingCost).toBe(5);
    expect(parseFloat(order.profitUsd || '0')).toBe(expectedProfit);
    expect(expectedProfit).toBe(3);
  });
});
