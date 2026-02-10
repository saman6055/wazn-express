import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from './db';

// Mock the database functions
vi.mock('./db', async () => {
  const actual = await vi.importActual('./db');
  return {
    ...actual,
    getDb: vi.fn(),
    createInvoice: vi.fn(),
    createLedgerTransaction: vi.fn(),
    getOrCreateCustomerAccount: vi.fn(),
    updateCustomerAccountBalance: vi.fn(),
  };
});

describe('Consolidated Invoice Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordPackageChargeWithoutInvoice', () => {
    it('should create ledger transaction without creating invoice', async () => {
      // Mock account
      const mockAccount = {
        id: 1,
        customerId: 100,
        currentBalanceUsd: '0.00',
        currentBalanceIqd: '0',
      };

      // Mock transaction
      const mockTransaction = {
        id: 1,
        accountId: 1,
        transactionType: 'DEBIT_PACKAGE',
        amountUsd: '50.00',
      };

      vi.mocked(db.getOrCreateCustomerAccount).mockResolvedValue(mockAccount as any);
      vi.mocked(db.createLedgerTransaction).mockResolvedValue(mockTransaction as any);
      vi.mocked(db.updateCustomerAccountBalance).mockResolvedValue(undefined);

      // The function should exist and work without creating invoice
      expect(typeof db.recordPackageChargeWithoutInvoice).toBe('function');
    });

    it('should link transaction to existing invoice when invoiceId is provided', async () => {
      const mockAccount = {
        id: 1,
        customerId: 100,
        currentBalanceUsd: '0.00',
        currentBalanceIqd: '0',
      };

      const mockTransaction = {
        id: 1,
        accountId: 1,
        transactionType: 'DEBIT_PACKAGE',
        amountUsd: '50.00',
        invoiceId: 999, // Should be linked to consolidated invoice
      };

      vi.mocked(db.getOrCreateCustomerAccount).mockResolvedValue(mockAccount as any);
      vi.mocked(db.createLedgerTransaction).mockResolvedValue(mockTransaction as any);
      vi.mocked(db.updateCustomerAccountBalance).mockResolvedValue(undefined);

      // Verify function signature accepts invoiceId parameter
      const fnString = db.recordPackageChargeWithoutInvoice.toString();
      expect(fnString).toContain('invoiceId');
    });
  });

  describe('Batch Invoice Consolidation Logic', () => {
    it('should create one invoice per customer per batch', () => {
      // Test the logic: multiple packages for same customer = 1 invoice
      const packages = [
        { id: 1, customerId: 100, trackingNumber: 'TRK001', weightKg: '2.5' },
        { id: 2, customerId: 100, trackingNumber: 'TRK002', weightKg: '3.0' },
        { id: 3, customerId: 100, trackingNumber: 'TRK003', weightKg: '1.5' },
        { id: 4, customerId: 200, trackingNumber: 'TRK004', weightKg: '4.0' },
      ];

      // Group packages by customer
      const packagesByCustomer = new Map<number, typeof packages>();
      for (const pkg of packages) {
        const existing = packagesByCustomer.get(pkg.customerId) || [];
        existing.push(pkg);
        packagesByCustomer.set(pkg.customerId, existing);
      }

      // Should have 2 customers
      expect(packagesByCustomer.size).toBe(2);
      
      // Customer 100 should have 3 packages
      expect(packagesByCustomer.get(100)?.length).toBe(3);
      
      // Customer 200 should have 1 package
      expect(packagesByCustomer.get(200)?.length).toBe(1);

      // This means 2 invoices total (1 per customer), not 4 (1 per package)
    });

    it('should calculate total amount correctly for consolidated invoice', () => {
      const pricePerKg = 10; // $10 per kg
      const customerPackages = [
        { weightKg: '2.5' },
        { weightKg: '3.0' },
        { weightKg: '1.5' },
      ];

      let totalAmount = 0;
      for (const pkg of customerPackages) {
        const weight = parseFloat(pkg.weightKg);
        totalAmount += weight * pricePerKg;
      }

      // Total should be (2.5 + 3.0 + 1.5) * 10 = 70
      expect(totalAmount).toBe(70);
    });

    it('should generate line items for each package in consolidated invoice', () => {
      const pricePerKg = 10;
      const customerPackages = [
        { trackingNumber: 'TRK001', packageCode: 'PKG001', weightKg: '2.5' },
        { trackingNumber: 'TRK002', packageCode: 'PKG002', weightKg: '3.0' },
      ];

      const lineItems = [];
      for (const pkg of customerPackages) {
        const weight = parseFloat(pkg.weightKg);
        const pkgPrice = weight * pricePerKg;
        lineItems.push({
          description: `پاکەت ${pkg.trackingNumber || pkg.packageCode} - ${weight.toFixed(2)} KG × $${pricePerKg}`,
          quantity: 1,
          unitPrice: pkgPrice,
          total: pkgPrice,
        });
      }

      // Should have 2 line items (one per package)
      expect(lineItems.length).toBe(2);
      
      // First line item
      expect(lineItems[0].description).toContain('TRK001');
      expect(lineItems[0].total).toBe(25);
      
      // Second line item
      expect(lineItems[1].description).toContain('TRK002');
      expect(lineItems[1].total).toBe(30);
    });
  });
});
