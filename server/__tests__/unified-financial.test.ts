/**
 * Unified Financial Model Tests
 * 
 * Business Model:
 * - Full Package & Purchase Request: Customer pays sellingPriceUsd (final price) ONLY
 * - Shipping cost is OUR cost, deducted from profit, NOT charged to customer
 * - Commission: Customer pays itemPrice + commissionFee, shipping is our cost
 * 
 * Profit Formulas:
 * - Full Package: profit = (sellingPrice - purchasePrice) * quantity - shippingCost
 * - Purchase Request: profit = (sellingPrice - purchasePrice) * quantity - shippingCost (SAME as Full Package)
 * - Commission: profit = commissionFee - shippingCost
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())('Unified Financial Model', () => {
  let testCustomerId: number;
  let testCustomerCode: string;
  let testFullPackageOrderId: number;
  let testPurchaseRequestOrderId: number;
  let testCommissionOrderId: number;
  const createdOrderIds: number[] = [];
  
  beforeAll(async () => {
    // Use existing customer from database
    const customers = await db.getAllCustomers();
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
      testCustomerCode = customers[0].customerCode;
    } else {
      throw new Error('No customers found in database for testing');
    }
  });
  
  afterAll(async () => {
    // Clean up test orders
    for (const orderId of createdOrderIds) {
      try {
        await db.deleteFullPackageOrder(orderId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });
  
  describe('Full Package Profit Calculation', () => {
    it('should calculate profit correctly: profit = (sellingPrice - purchasePrice) * quantity - shippingCost', async () => {
      // Scenario: Item costs $10, we sell for $50, shipping costs $20
      // Expected profit: ($50 - $10) * 1 - $20 = $20
      const order = await db.createFullPackageOrder({
        orderCode: 'FP-TEST-' + Date.now(),
        customerId: testCustomerId,
        orderType: 'full_package',
        productName: 'Test Product',
        quantity: 1,
        purchasePriceUsd: '10.00',
        sellingPriceUsd: '50.00',
        shippingCostUsd: '20.00',
        createdById: 1
      });
      
      testFullPackageOrderId = order.id;
      createdOrderIds.push(order.id);
      
      expect(order.profitUsd).toBe('20.00');
      expect(order.orderType).toBe('full_package');
    });
    
    it('should calculate profit with multiple quantities', async () => {
      // Scenario: Item costs $10, we sell for $50, quantity 3, shipping $30
      // Expected profit: ($50 - $10) * 3 - $30 = $90
      const order = await db.createFullPackageOrder({
        orderCode: 'FP-QTY-' + Date.now(),
        customerId: testCustomerId,
        orderType: 'full_package',
        productName: 'Test Product Multiple',
        quantity: 3,
        purchasePriceUsd: '10.00',
        sellingPriceUsd: '50.00',
        shippingCostUsd: '30.00',
        createdById: 1
      });
      
      expect(order.profitUsd).toBe('90.00');
      createdOrderIds.push(order.id);
    });
    
    it('should recalculate profit when prices are updated', async () => {
      // Update the test order with new prices
      // New: purchasePrice $15, sellingPrice $60, shipping $25
      // Expected profit: ($60 - $15) * 1 - $25 = $20
      const updated = await db.updateFullPackageOrder(testFullPackageOrderId, {
        purchasePriceUsd: '15.00',
        sellingPriceUsd: '60.00',
        shippingCostUsd: '25.00'
      });
      
      expect(updated?.profitUsd).toBe('20.00');
    });
  });
  
  describe('Purchase Request Profit Calculation (Same as Full Package)', () => {
    it('should use SAME formula as Full Package: profit = (sellingPrice - purchasePrice) * quantity - shippingCost', async () => {
      // Scenario: Item costs $20, we sell for $80, shipping costs $15
      // Expected profit: ($80 - $20) * 1 - $15 = $45
      const order = await db.createFullPackageOrder({
        orderCode: 'PR-TEST-' + Date.now(),
        customerId: testCustomerId,
        orderType: 'purchase_request',
        productName: 'Test Purchase Request',
        quantity: 1,
        purchasePriceUsd: '20.00',
        sellingPriceUsd: '80.00',
        shippingCostUsd: '15.00',
        createdById: 1
      });
      
      testPurchaseRequestOrderId = order.id;
      createdOrderIds.push(order.id);
      
      expect(order.profitUsd).toBe('45.00');
      expect(order.orderType).toBe('purchase_request');
    });
    
    it('should handle purchase request with zero shipping cost', async () => {
      // Scenario: Item costs $30, we sell for $100, no shipping yet
      // Expected profit: ($100 - $30) * 1 - $0 = $70
      const order = await db.createFullPackageOrder({
        orderCode: 'PR-NOSHIP-' + Date.now(),
        customerId: testCustomerId,
        orderType: 'purchase_request',
        productName: 'Test No Shipping',
        quantity: 1,
        purchasePriceUsd: '30.00',
        sellingPriceUsd: '100.00',
        shippingCostUsd: '0.00',
        createdById: 1
      });
      
      expect(order.profitUsd).toBe('70.00');
      createdOrderIds.push(order.id);
    });
  });
  
  describe('Commission Order Profit Calculation', () => {
    it('should calculate profit: profit = commissionFee - shippingCost', async () => {
      // Scenario: Item costs $200 (customer knows), commission $30, shipping $10
      // Expected profit: $30 - $10 = $20
      const order = await db.createFullPackageOrder({
        orderCode: 'COM-TEST-' + Date.now(),
        customerId: testCustomerId,
        orderType: 'commission',
        productName: 'Test Commission Order',
        quantity: 1,
        itemPriceUsd: '200.00',
        commissionFeeUsd: '30.00',
        shippingCostUsd: '10.00',
        createdById: 1
      });
      
      testCommissionOrderId = order.id;
      createdOrderIds.push(order.id);
      
      expect(order.profitUsd).toBe('20.00');
      expect(order.orderType).toBe('commission');
    });
  });
  
  describe.skip('Customer Charge Logic', () => {
    it('should charge ONLY sellingPriceUsd to customer for Full Package (not shipping)', async () => {
      // Create a new order to test charging
      const order = await db.createFullPackageOrder({
        orderCode: 'FP-CHARGE-' + Date.now(),
        customerId: testCustomerId,
        orderType: 'full_package',
        productName: 'Test Charge Product',
        quantity: 1,
        purchasePriceUsd: '10.00',
        sellingPriceUsd: '50.00', // Customer should pay $50 ONLY
        shippingCostUsd: '20.00', // This is OUR cost, not charged to customer
        createdById: 1
      });
      
      createdOrderIds.push(order.id);
      
      // Get customer balance before
      const balanceBefore = await db.getCustomerBalance(testCustomerId);
      
      // Update to delivered (should trigger charge)
      await db.updateFullPackageOrder(order.id, {
        status: 'delivered'
      }, 1);
      
      // Get customer balance after
      const balanceAfter = await db.getCustomerBalance(testCustomerId);
      
      // Customer should be charged $50 (sellingPriceUsd), NOT $70 (selling + shipping)
      // Balance increases (debt) by $50
      const chargeAmount = balanceAfter - balanceBefore;
      expect(chargeAmount).toBe(50);
      
      // Verify order is marked as charged
      const updatedOrder = await db.getFullPackageOrderById(order.id);
      expect(updatedOrder?.isCharged).toBe(true);
    });
    
    it('should charge itemPrice + commissionFee for Commission orders', async () => {
      // Create a new commission order
      const order = await db.createFullPackageOrder({
        orderCode: 'COM-CHARGE-' + Date.now(),
        customerId: testCustomerId,
        orderType: 'commission',
        productName: 'Test Commission Charge',
        quantity: 1,
        itemPriceUsd: '100.00',
        commissionFeeUsd: '15.00',
        shippingCostUsd: '10.00', // Our cost
        createdById: 1
      });
      
      createdOrderIds.push(order.id);
      
      // Get customer balance before
      const balanceBefore = await db.getCustomerBalance(testCustomerId);
      
      // Update to delivered
      await db.updateFullPackageOrder(order.id, {
        status: 'delivered'
      }, 1);
      
      // Get customer balance after
      const balanceAfter = await db.getCustomerBalance(testCustomerId);
      
      // Customer should be charged $115 (itemPrice + commissionFee), NOT $125 (with shipping)
      const chargeAmount = balanceAfter - balanceBefore;
      expect(chargeAmount).toBe(115);
    });
  });
  
  describe.skip('Profit Verification Examples', () => {
    it('Example 1: Full Package - Item $10, Sell $50, Ship $20 = Profit $20', async () => {
      const order = await db.createFullPackageOrder({
        orderCode: 'EX1-' + Date.now(),
        customerId: testCustomerId,
        orderType: 'full_package',
        productName: 'Example 1',
        quantity: 1,
        purchasePriceUsd: '10.00',
        sellingPriceUsd: '50.00',
        shippingCostUsd: '20.00',
        createdById: 1
      });
      
      // Verify: profit = (50 - 10) * 1 - 20 = 20
      expect(order.profitUsd).toBe('20.00');
      createdOrderIds.push(order.id);
    });
    
    it('Example 2: Purchase Request - Item $25, Sell $100, Ship $15 = Profit $60', async () => {
      const order = await db.createFullPackageOrder({
        orderCode: 'EX2-' + Date.now(),
        customerId: testCustomerId,
        orderType: 'purchase_request',
        productName: 'Example 2',
        quantity: 1,
        purchasePriceUsd: '25.00',
        sellingPriceUsd: '100.00',
        shippingCostUsd: '15.00',
        createdById: 1
      });
      
      // Verify: profit = (100 - 25) * 1 - 15 = 60
      expect(order.profitUsd).toBe('60.00');
      createdOrderIds.push(order.id);
    });
    
    it('Example 3: Commission - Item $200, Commission $30, Ship $10 = Profit $20', async () => {
      const order = await db.createFullPackageOrder({
        orderCode: 'EX3-' + Date.now(),
        customerId: testCustomerId,
        orderType: 'commission',
        productName: 'Example 3',
        quantity: 1,
        itemPriceUsd: '200.00',
        commissionFeeUsd: '30.00',
        shippingCostUsd: '10.00',
        createdById: 1
      });
      
      // Verify: profit = 30 - 10 = 20
      expect(order.profitUsd).toBe('20.00');
      createdOrderIds.push(order.id);
    });
  });
});
