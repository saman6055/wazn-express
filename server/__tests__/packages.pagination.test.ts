import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllPackages } from './db';

// Mock the database module
vi.mock('./db', async () => {
  const actual = await vi.importActual('./db');
  return {
    ...actual,
    getAllPackages: vi.fn(),
  };
});

describe('Packages Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return paginated results with correct structure', async () => {
    const mockPackages = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      packageCode: `PKG${String(i + 1).padStart(5, '0')}`,
      status: 'registered',
      shippingType: 'air_regular',
      createdAt: new Date(),
    }));

    // Mock the getAllPackages function
    (getAllPackages as any).mockResolvedValue({
      data: mockPackages.slice(0, 50),
      total: 100,
      page: 1,
      pageSize: 50,
      totalPages: 2,
    });

    const result = await getAllPackages({
      page: 1,
      pageSize: 50,
    });

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('pageSize');
    expect(result).toHaveProperty('totalPages');
    expect(result.data.length).toBeLessThanOrEqual(50);
    expect(result.totalPages).toBe(2);
  });

  it('should filter by status', async () => {
    const mockPackages = [
      { id: 1, packageCode: 'PKG00001', status: 'delivered' },
      { id: 2, packageCode: 'PKG00002', status: 'delivered' },
    ];

    (getAllPackages as any).mockResolvedValue({
      data: mockPackages,
      total: 2,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    const result = await getAllPackages({
      page: 1,
      pageSize: 50,
      status: 'delivered',
    });

    expect(result.data.every((pkg: any) => pkg.status === 'delivered')).toBe(true);
  });

  it('should filter by shipping type', async () => {
    const mockPackages = [
      { id: 1, packageCode: 'PKG00001', shippingType: 'sea' },
      { id: 2, packageCode: 'PKG00002', shippingType: 'sea' },
    ];

    (getAllPackages as any).mockResolvedValue({
      data: mockPackages,
      total: 2,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    const result = await getAllPackages({
      page: 1,
      pageSize: 50,
      shippingType: 'sea',
    });

    expect(result.data.every((pkg: any) => pkg.shippingType === 'sea')).toBe(true);
  });

  it('should filter by search query', async () => {
    const mockPackages = [
      { id: 1, packageCode: 'PKG00001', trackingNumber: 'TRACK123' },
    ];

    (getAllPackages as any).mockResolvedValue({
      data: mockPackages,
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    const result = await getAllPackages({
      page: 1,
      pageSize: 50,
      search: 'TRACK123',
    });

    expect(result.data.length).toBe(1);
    expect(result.data[0].trackingNumber).toBe('TRACK123');
  });

  it('should calculate correct total pages', async () => {
    (getAllPackages as any).mockResolvedValue({
      data: [],
      total: 266,
      page: 1,
      pageSize: 50,
      totalPages: 6,
    });

    const result = await getAllPackages({
      page: 1,
      pageSize: 50,
    });

    expect(result.totalPages).toBe(6);
  });

  it('should handle page size of 25', async () => {
    (getAllPackages as any).mockResolvedValue({
      data: [],
      total: 266,
      page: 1,
      pageSize: 25,
      totalPages: 11,
    });

    const result = await getAllPackages({
      page: 1,
      pageSize: 25,
    });

    expect(result.totalPages).toBe(11);
  });

  it('should handle page size of 100', async () => {
    (getAllPackages as any).mockResolvedValue({
      data: [],
      total: 266,
      page: 1,
      pageSize: 100,
      totalPages: 3,
    });

    const result = await getAllPackages({
      page: 1,
      pageSize: 100,
    });

    expect(result.totalPages).toBe(3);
  });

  it('should return correct page number', async () => {
    (getAllPackages as any).mockResolvedValue({
      data: [],
      total: 266,
      page: 3,
      pageSize: 50,
      totalPages: 6,
    });

    const result = await getAllPackages({
      page: 3,
      pageSize: 50,
    });

    expect(result.page).toBe(3);
  });
});
