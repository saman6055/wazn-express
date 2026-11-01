import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from './db';
import { hasDb } from "./testEnv";

// Mock the database module
vi.mock('./db', async () => {
  const actual = await vi.importActual('./db');
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

describe.skipIf(!hasDb())('Data Management Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDataCounts', () => {
    it('should return counts for all data types', async () => {
      const counts = await db.getDataCounts();
      
      expect(counts).toHaveProperty('customers');
      expect(counts).toHaveProperty('packages');
      expect(counts).toHaveProperty('batches');
      expect(counts).toHaveProperty('invoices');
      expect(counts).toHaveProperty('payments');
      expect(counts).toHaveProperty('expenses');
      expect(counts).toHaveProperty('ledgerEntries');
      expect(counts).toHaveProperty('fullPackages');
      expect(counts).toHaveProperty('suppliers');
      
      // All counts should be numbers
      expect(typeof counts.customers).toBe('number');
      expect(typeof counts.packages).toBe('number');
      expect(typeof counts.batches).toBe('number');
      expect(typeof counts.invoices).toBe('number');
      expect(typeof counts.payments).toBe('number');
      expect(typeof counts.expenses).toBe('number');
      expect(typeof counts.ledgerEntries).toBe('number');
      expect(typeof counts.fullPackages).toBe('number');
      expect(typeof counts.suppliers).toBe('number');
    });

    it('should return non-negative counts', async () => {
      const counts = await db.getDataCounts();
      
      expect(counts.customers).toBeGreaterThanOrEqual(0);
      expect(counts.packages).toBeGreaterThanOrEqual(0);
      expect(counts.batches).toBeGreaterThanOrEqual(0);
      expect(counts.invoices).toBeGreaterThanOrEqual(0);
      expect(counts.payments).toBeGreaterThanOrEqual(0);
      expect(counts.expenses).toBeGreaterThanOrEqual(0);
      expect(counts.ledgerTransactions).toBeGreaterThanOrEqual(0);
      expect(counts.fullPackages).toBeGreaterThanOrEqual(0);
      expect(counts.suppliers).toBeGreaterThanOrEqual(0);
    });
  });

  describe('deleteAllCustomers', () => {
    it('should return success result with deletedCount', async () => {
      const result = await db.deleteAllCustomers();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('deletedCount');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.deletedCount).toBe('number');
    });
  });

  describe('deleteAllPackages', () => {
    it('should return success result with deletedCount', async () => {
      const result = await db.deleteAllPackages();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('deletedCount');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.deletedCount).toBe('number');
    });
  });

  describe('deleteAllBatches', () => {
    it('should return success result with deletedCount', async () => {
      const result = await db.deleteAllBatches();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('deletedCount');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.deletedCount).toBe('number');
    });
  });

  describe('deleteAllInvoices', () => {
    it('should return success result with deletedCount', async () => {
      const result = await db.deleteAllInvoices();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('deletedCount');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.deletedCount).toBe('number');
    });
  });

  describe('deleteAllPayments', () => {
    it('should return success result with deletedCount', async () => {
      const result = await db.deleteAllPayments();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('deletedCount');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.deletedCount).toBe('number');
    });
  });

  describe('deleteAllExpenses', () => {
    it('should return success result with deletedCount', async () => {
      const result = await db.deleteAllExpenses();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('deletedCount');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.deletedCount).toBe('number');
    });
  });

  describe('deleteAllLedgerEntries', () => {
    it('should return success result with deletedCount', async () => {
      const result = await db.deleteAllLedgerEntries();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('deletedCount');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.deletedCount).toBe('number');
    });
  });

  describe('deleteAllFullPackages', () => {
    it('should return success result with deletedCount', async () => {
      const result = await db.deleteAllFullPackages();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('deletedCount');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.deletedCount).toBe('number');
    });
  });

  describe('deleteAllSuppliers', () => {
    it('should return success result with deletedCount', async () => {
      const result = await db.deleteAllSuppliers();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('deletedCount');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.deletedCount).toBe('number');
    });
  });

  describe('resetAllData', () => {
    it('should return success result with message', async () => {
      const result = await db.resetAllData();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });
});
