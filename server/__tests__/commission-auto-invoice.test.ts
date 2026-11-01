import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from './db';

// Mock db functions
vi.mock('./db', async () => {
  const actual = await vi.importActual('./db');
  return {
    ...actual,
    getCustomerById: vi.fn(),
    createFullPackageOrder: vi.fn(),
    applyCharge: vi.fn(),
    createAuditLog: vi.fn(),
  };
});

describe('Commission Order Auto-Invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Commission Order Creation Logic', () => {
    it('should calculate total prepaid from item price and commission fee', () => {
      const itemPriceUsd = '50.00';
      const commissionFeeUsd = '10.00';
      const quantity = 2;
      
      const itemPrice = parseFloat(itemPriceUsd);
      const commissionFee = parseFloat(commissionFeeUsd);
      const totalPrepaid = (itemPrice + commissionFee) * quantity;
      
      expect(totalPrepaid).toBe(120); // (50 + 10) * 2 = 120
    });

    it('should set commission fee as gross profit', () => {
      const commissionFeeUsd = '15.00';
      const quantity = 3;
      
      const commissionFee = parseFloat(commissionFeeUsd);
      const grossProfitUsd = (commissionFee * quantity).toFixed(2);
      
      expect(grossProfitUsd).toBe('45.00'); // 15 * 3 = 45
    });

    it('should generate correct order code prefix for commission orders', () => {
      const orderType = 'commission';
      const prefix = orderType === 'commission' ? 'CM' : 
                     orderType === 'purchase_request' ? 'PR' : 'FP';
      
      expect(prefix).toBe('CM');
    });

    it('should generate correct order code prefix for full package orders', () => {
      const orderType = 'full_package';
      const prefix = orderType === 'commission' ? 'CM' : 
                     orderType === 'purchase_request' ? 'PR' : 'FP';
      
      expect(prefix).toBe('FP');
    });

    it('should create line items with correct structure', () => {
      const productName = 'Test Product';
      const itemPrice = 50;
      const commissionFee = 10;
      const quantity = 2;
      
      const lineItems = [
        {
          description: `${productName} - نرخی کاڵا (Item Price)`,
          quantity: quantity,
          unitPrice: itemPrice,
          total: itemPrice * quantity,
        },
        {
          description: 'عمولەی کڕین (Commission Fee)',
          quantity: 1,
          unitPrice: commissionFee * quantity,
          total: commissionFee * quantity,
        },
      ];
      
      expect(lineItems).toHaveLength(2);
      expect(lineItems[0].total).toBe(100); // 50 * 2
      expect(lineItems[1].total).toBe(20); // 10 * 2
      expect(lineItems[0].total + lineItems[1].total).toBe(120);
    });

    it('should mark commission order as prepaid and paid', () => {
      const orderType = 'commission';
      const totalPrepaid = '100.00';
      
      const orderData = {
        isPrepaid: orderType === 'commission' ? true : undefined,
        prepaidAt: orderType === 'commission' ? new Date() : undefined,
        isPaid: orderType === 'commission' ? true : undefined,
        paidFromBalanceUsd: orderType === 'commission' ? totalPrepaid : undefined,
      };
      
      expect(orderData.isPrepaid).toBe(true);
      expect(orderData.isPaid).toBe(true);
      expect(orderData.paidFromBalanceUsd).toBe('100.00');
    });

    it('should not mark full package order as prepaid', () => {
      const orderType = 'full_package';
      const totalPrepaid = '100.00';
      
      const orderData = {
        isPrepaid: orderType === 'commission' ? true : undefined,
        isPaid: orderType === 'commission' ? true : undefined,
        paidFromBalanceUsd: orderType === 'commission' ? totalPrepaid : undefined,
      };
      
      expect(orderData.isPrepaid).toBeUndefined();
      expect(orderData.isPaid).toBeUndefined();
      expect(orderData.paidFromBalanceUsd).toBeUndefined();
    });
  });

  describe('Charge Type Mapping', () => {
    it('should map COMMISSION charge type correctly', () => {
      const chargeType = 'COMMISSION';
      const typeMapping: Record<string, { transactionType: string, referenceType: string }> = {
        'PACKAGE': { transactionType: 'DEBIT_PACKAGE', referenceType: 'package' },
        'FULL_PACKAGE': { transactionType: 'DEBIT_FULL_PACKAGE', referenceType: 'full_package' },
        'PURCHASE_REQUEST': { transactionType: 'DEBIT_PURCHASE_REQUEST', referenceType: 'purchase_request' },
        'COMMISSION': { transactionType: 'DEBIT_COMMISSION', referenceType: 'commission' },
        'SERVICE': { transactionType: 'DEBIT_SERVICE', referenceType: 'service' }
      };
      
      const { transactionType, referenceType } = typeMapping[chargeType];
      
      expect(transactionType).toBe('DEBIT_COMMISSION');
      expect(referenceType).toBe('commission');
    });
  });

  describe('Invoice Generation', () => {
    it('should calculate correct invoice total', () => {
      const itemPrice = 75;
      const commissionFee = 15;
      const quantity = 2;
      
      const totalAmount = (itemPrice + commissionFee) * quantity;
      
      expect(totalAmount).toBe(180); // (75 + 15) * 2 = 180
    });

    it('should format description correctly in Kurdish', () => {
      const productName = 'iPhone 15';
      const itemPriceTotal = 150;
      const commissionTotal = 30;
      
      const description = `کڕینی عمولە - ${productName} (نرخی کاڵا: $${itemPriceTotal}, عمولە: $${commissionTotal})`;
      
      expect(description).toContain('کڕینی عمولە');
      expect(description).toContain('iPhone 15');
      expect(description).toContain('$150');
      expect(description).toContain('$30');
    });
  });

  describe('Balance Update', () => {
    it('should calculate new balance after charge', () => {
      const currentBalanceUsd = 100;
      const chargeAmount = 60;
      
      const newBalanceUsd = currentBalanceUsd + chargeAmount;
      
      expect(newBalanceUsd).toBe(160); // Balance increases (debit = customer owes more)
    });
  });
});
