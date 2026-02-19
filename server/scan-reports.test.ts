import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('Scan Reports', () => {
  // Test getScansByDateRange function
  describe('getScansByDateRange', () => {
    it('should return scans within date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      
      const result = await db.getScansByDateRange(startDate, endDate);
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('should filter by scan type when provided', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      
      const result = await db.getScansByDateRange(startDate, endDate, 'registered');
      expect(Array.isArray(result)).toBe(true);
      // All results should have the specified scan type
      result.forEach((item: any) => {
        if (item.scan) {
          expect(item.scan.scanType).toBe('registered');
        }
      });
    });
    
    it('should return all scan types when filter is "all"', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      
      const result = await db.getScansByDateRange(startDate, endDate, 'all');
      expect(Array.isArray(result)).toBe(true);
    });
  });
  
  // Test getScanStatsByDateRange function
  describe('getScanStatsByDateRange', () => {
    it('should return scan statistics grouped by type and date', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      
      const result = await db.getScanStatsByDateRange(startDate, endDate);
      expect(Array.isArray(result)).toBe(true);
      // Each result should have scanType, count, and date
      result.forEach((item: any) => {
        expect(item).toHaveProperty('scanType');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('date');
      });
    });
  });
  
  // Test getDailyScanSummary function
  describe('getDailyScanSummary', () => {
    it('should return daily scan summary grouped by type and hour', async () => {
      const today = new Date();
      
      const result = await db.getDailyScanSummary(today);
      expect(Array.isArray(result)).toBe(true);
      // Each result should have scanType, count, and hour
      result.forEach((item: any) => {
        expect(item).toHaveProperty('scanType');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('hour');
      });
    });
  });
  
  // Test getMonthlyScanSummary function
  describe('getMonthlyScanSummary', () => {
    it('should return monthly scan summary grouped by type and day', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      const result = await db.getMonthlyScanSummary(year, month);
      expect(Array.isArray(result)).toBe(true);
      // Each result should have scanType, count, and day
      result.forEach((item: any) => {
        expect(item).toHaveProperty('scanType');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('day');
      });
    });
  });
  
  // Test getScanTotalsByType function
  describe('getScanTotalsByType', () => {
    it('should return total scans grouped by type', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      
      const result = await db.getScanTotalsByType(startDate, endDate);
      expect(Array.isArray(result)).toBe(true);
      // Each result should have scanType and count
      result.forEach((item: any) => {
        expect(item).toHaveProperty('scanType');
        expect(item).toHaveProperty('count');
      });
    });
  });
  
  // Test getScansByEmployee function
  describe('getScansByEmployee', () => {
    it('should return scans grouped by employee and type', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      
      const result = await db.getScansByEmployee(startDate, endDate);
      expect(Array.isArray(result)).toBe(true);
      // Each result should have userId, userName, scanType, and count
      result.forEach((item: any) => {
        expect(item).toHaveProperty('userId');
        expect(item).toHaveProperty('scanType');
        expect(item).toHaveProperty('count');
      });
    });
  });
});

describe('Notification System', () => {
  // Test that notification functions exist and are callable
  describe('notifyPackageStatusChange', () => {
    it('should be a function', async () => {
      const { notifyPackageStatusChange } = await import('./services/notification.service');
      expect(typeof notifyPackageStatusChange).toBe('function');
    });
  });
  
  describe('notifyBatchStatusChange', () => {
    it('should be a function', async () => {
      const { notifyBatchStatusChange } = await import('./services/notification.service');
      expect(typeof notifyBatchStatusChange).toBe('function');
    });
  });
  
  describe('sendNotification', () => {
    it('should be a function', async () => {
      const { sendNotification } = await import('./services/notification.service');
      expect(typeof sendNotification).toBe('function');
    });
  });
  
  describe('statusToEventType mapping', () => {
    it('should map package statuses to notification event types', async () => {
      const { statusToEventType } = await import('./services/notification.service');
      
      expect(statusToEventType['registered']).toBe('package_registered');
      expect(statusToEventType['in_batch']).toBe('package_in_batch');
      expect(statusToEventType['in_transit']).toBe('package_in_transit');
      expect(statusToEventType['customs_processing']).toBe('package_customs');
      expect(statusToEventType['ready_for_delivery']).toBe('package_ready_delivery');
      expect(statusToEventType['out_for_delivery']).toBe('package_out_delivery');
      expect(statusToEventType['delivered']).toBe('package_delivered');
    });
  });
});
