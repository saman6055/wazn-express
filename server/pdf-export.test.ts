import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock the database functions
vi.mock('./db', async () => {
  const actual = await vi.importActual('./db');
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getActiveBatches: vi.fn().mockResolvedValue([
      { batchCode: 'BATCH-001', status: 'preparing', totalWeight: '50.5' },
      { batchCode: 'BATCH-002', status: 'in_transit', totalWeight: '120.0' }
    ])
  };
});

describe('PDF Export', () => {
  it('should generate dashboard report data', async () => {
    const { getDashboardReportData } = await import('./services/pdf.service');
    
    const data = await getDashboardReportData();
    
    expect(data).toBeDefined();
    expect(data.generatedAt).toBeInstanceOf(Date);
    expect(data.financialStats).toBeDefined();
    expect(data.financialStats.todayRevenue).toBeGreaterThanOrEqual(0);
    expect(data.packageStats).toBeDefined();
    expect(Array.isArray(data.packageStats)).toBe(true);
    expect(data.activeBatches).toBeDefined();
    expect(Array.isArray(data.activeBatches)).toBe(true);
  });

  it('should generate PDF buffer', async () => {
    const { generateDashboardPDF, getDashboardReportData } = await import('./services/pdf.service');
    
    const data = await getDashboardReportData();
    const pdfBuffer = await generateDashboardPDF(data);
    
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    
    // Check PDF magic bytes
    const pdfHeader = pdfBuffer.slice(0, 4).toString();
    expect(pdfHeader).toBe('%PDF');
  });

  it('should include financial stats in report data', async () => {
    const { getDashboardReportData } = await import('./services/pdf.service');
    
    const data = await getDashboardReportData();
    
    expect(data.financialStats).toHaveProperty('todayRevenue');
    expect(data.financialStats).toHaveProperty('weekRevenue');
    expect(data.financialStats).toHaveProperty('monthRevenue');
    expect(data.financialStats).toHaveProperty('totalDebt');
    expect(data.financialStats).toHaveProperty('todayPackages');
  });

  it('should format active batches correctly', async () => {
    const { getDashboardReportData } = await import('./services/pdf.service');
    
    const data = await getDashboardReportData();
    
    if (data.activeBatches.length > 0) {
      const batch = data.activeBatches[0];
      expect(batch).toHaveProperty('batchCode');
      expect(batch).toHaveProperty('status');
      expect(batch).toHaveProperty('totalWeight');
      expect(typeof batch.totalWeight).toBe('number');
    }
  });
});
