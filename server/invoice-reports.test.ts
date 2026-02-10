import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as db from './db';

describe('Invoice Reports', () => {
  // Test getInvoiceSummary
  describe('getInvoiceSummary', () => {
    it('should return invoice summary with correct structure', async () => {
      const summary = await db.getInvoiceSummary();
      
      expect(summary).toBeDefined();
      expect(typeof summary.totalInvoices).toBe('number');
      expect(typeof summary.totalAmountUsd).toBe('number');
      expect(typeof summary.paidInvoices).toBe('number');
      expect(typeof summary.paidAmountUsd).toBe('number');
      expect(typeof summary.unpaidInvoices).toBe('number');
      expect(typeof summary.unpaidAmountUsd).toBe('number');
      expect(typeof summary.averageInvoiceUsd).toBe('number');
      
      // Verify totals are consistent
      expect(summary.paidInvoices + summary.unpaidInvoices).toBeLessThanOrEqual(summary.totalInvoices);
    });

    it('should filter by date range when provided', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');
      
      const summary = await db.getInvoiceSummary(startDate, endDate);
      
      expect(summary).toBeDefined();
      expect(typeof summary.totalInvoices).toBe('number');
    });
  });

  // Test getMonthlyInvoiceReport
  describe('getMonthlyInvoiceReport', () => {
    it('should return monthly breakdown for a year', async () => {
      const year = 2026;
      const report = await db.getMonthlyInvoiceReport(year);
      
      expect(report).toBeDefined();
      expect(Array.isArray(report)).toBe(true);
      expect(report.length).toBe(12); // Should have 12 months
      
      // Verify each month has correct structure
      for (const month of report) {
        expect(month.year).toBe(year);
        expect(month.monthNumber).toBeGreaterThanOrEqual(1);
        expect(month.monthNumber).toBeLessThanOrEqual(12);
        expect(typeof month.totalInvoices).toBe('number');
        expect(typeof month.totalAmountUsd).toBe('number');
        expect(typeof month.paidAmountUsd).toBe('number');
        expect(typeof month.unpaidAmountUsd).toBe('number');
      }
    });

    it('should return months in order', async () => {
      const report = await db.getMonthlyInvoiceReport(2026);
      
      for (let i = 0; i < report.length; i++) {
        expect(report[i].monthNumber).toBe(i + 1);
      }
    });
  });

  // Test getYearlyInvoiceReport
  describe('getYearlyInvoiceReport', () => {
    it('should return yearly summary for multiple years', async () => {
      const years = [2024, 2025, 2026];
      const report = await db.getYearlyInvoiceReport(years);
      
      expect(report).toBeDefined();
      expect(Array.isArray(report)).toBe(true);
      expect(report.length).toBe(years.length);
      
      // Verify each year has correct structure (year + summary)
      for (const yearData of report) {
        expect(years).toContain(yearData.year);
        expect(yearData.summary).toBeDefined();
        expect(typeof yearData.summary.totalInvoices).toBe('number');
        expect(typeof yearData.summary.totalAmountUsd).toBe('number');
        expect(typeof yearData.summary.paidAmountUsd).toBe('number');
        expect(typeof yearData.summary.unpaidAmountUsd).toBe('number');
      }
    });
  });

  // Test getInvoicesByCustomerReport
  describe('getInvoicesByCustomerReport', () => {
    it('should return customer invoice statistics', async () => {
      const report = await db.getInvoicesByCustomerReport();
      
      expect(report).toBeDefined();
      expect(Array.isArray(report)).toBe(true);
      
      // Verify structure if there are results
      if (report.length > 0) {
        const customer = report[0];
        expect(typeof customer.customerId).toBe('number');
        expect(typeof customer.customerCode).toBe('string');
        expect(typeof customer.customerName).toBe('string');
        expect(typeof customer.totalInvoices).toBe('number');
        expect(typeof customer.totalAmountUsd).toBe('number');
        expect(typeof customer.paidAmountUsd).toBe('number');
        expect(typeof customer.unpaidAmountUsd).toBe('number');
      }
    });

    it('should respect limit parameter', async () => {
      const limit = 5;
      const report = await db.getInvoicesByCustomerReport(undefined, undefined, limit);
      
      expect(report.length).toBeLessThanOrEqual(limit);
    });

    it('should sort by total amount descending', async () => {
      const report = await db.getInvoicesByCustomerReport();
      
      for (let i = 1; i < report.length; i++) {
        expect(report[i - 1].totalAmountUsd).toBeGreaterThanOrEqual(report[i].totalAmountUsd);
      }
    });
  });

  // Test getInvoicesByServiceTypeReport
  describe('getInvoicesByServiceTypeReport', () => {
    it('should return service type invoice statistics', async () => {
      const report = await db.getInvoicesByServiceTypeReport();
      
      expect(report).toBeDefined();
      expect(Array.isArray(report)).toBe(true);
      
      // Verify structure if there are results
      if (report.length > 0) {
        const serviceType = report[0];
        expect(typeof serviceType.serviceType).toBe('string');
        expect(typeof serviceType.totalInvoices).toBe('number');
        expect(typeof serviceType.totalAmountUsd).toBe('number');
        expect(typeof serviceType.averageAmountUsd).toBe('number');
      }
    });

    it('should calculate average correctly', async () => {
      const report = await db.getInvoicesByServiceTypeReport();
      
      for (const serviceType of report) {
        if (serviceType.totalInvoices > 0) {
          const expectedAverage = serviceType.totalAmountUsd / serviceType.totalInvoices;
          expect(serviceType.averageAmountUsd).toBeCloseTo(expectedAverage, 2);
        }
      }
    });
  });

  // Test getRecentInvoices
  describe('getRecentInvoices', () => {
    it('should return paginated invoices', async () => {
      const result = await db.getRecentInvoices(1, 10);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result.invoices)).toBe(true);
      expect(typeof result.total).toBe('number');
      expect(typeof result.page).toBe('number');
      expect(typeof result.pageSize).toBe('number');
      expect(typeof result.totalPages).toBe('number');
      
      expect(result.invoices.length).toBeLessThanOrEqual(10);
    });

    it('should filter by status when provided', async () => {
      const result = await db.getRecentInvoices(1, 10, 'paid');
      
      expect(result).toBeDefined();
      // All invoices should be paid
      for (const invoice of result.invoices) {
        expect(invoice.status).toBe('paid');
      }
    });

    it('should calculate pagination correctly', async () => {
      const pageSize = 5;
      const result = await db.getRecentInvoices(1, pageSize);
      
      const expectedTotalPages = Math.ceil(result.total / pageSize);
      expect(result.totalPages).toBe(expectedTotalPages);
    });
  });
});
