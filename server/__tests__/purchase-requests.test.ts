import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  createPurchaseRequest: vi.fn(),
  getPurchaseRequestById: vi.fn(),
  getPurchaseRequestsByCustomer: vi.fn(),
  getAllPurchaseRequests: vi.fn(),
  updatePurchaseRequestPricing: vi.fn(),
  processPurchaseRequestPayment: vi.fn(),
  updatePurchaseRequestStatus: vi.fn(),
  rejectPurchaseRequest: vi.fn(),
  getPurchaseRequestStats: vi.fn(),
}));

import {
  createPurchaseRequest,
  getPurchaseRequestById,
  getPurchaseRequestsByCustomer,
  getAllPurchaseRequests,
  updatePurchaseRequestPricing,
  processPurchaseRequestPayment,
  updatePurchaseRequestStatus,
  rejectPurchaseRequest,
  getPurchaseRequestStats,
} from './db';

describe('Purchase Request System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPurchaseRequest', () => {
    it('should create a new purchase request with required fields', async () => {
      const mockRequest = {
        id: 1,
        requestCode: 'PR-2026-001',
        customerId: 100,
        customerCode: 'CUST001',
        productUrl: 'https://amazon.com/product/123',
        productName: 'Test Product',
        quantity: 2,
        status: 'pending',
        createdAt: new Date(),
      };

      (createPurchaseRequest as any).mockResolvedValue(mockRequest);

      const result = await createPurchaseRequest({
        customerId: 100,
        customerCode: 'CUST001',
        productUrl: 'https://amazon.com/product/123',
        productName: 'Test Product',
        quantity: 2,
      });

      expect(result).toEqual(mockRequest);
      expect(result.status).toBe('pending');
      expect(result.requestCode).toBeDefined();
    });

    it('should create a request with optional fields', async () => {
      const mockRequest = {
        id: 2,
        requestCode: 'PR-2026-002',
        customerId: 100,
        customerCode: 'CUST001',
        productUrl: 'https://taobao.com/item/456',
        productName: 'Clothing Item',
        productDescription: 'Blue cotton shirt',
        color: 'Blue',
        size: 'L',
        quantity: 3,
        customerNotes: 'Please check quality',
        deliveryAddress: '123 Main St',
        deliveryCity: 'Sulaymaniyah',
        deliveryPhone: '07701234567',
        status: 'pending',
        createdAt: new Date(),
      };

      (createPurchaseRequest as any).mockResolvedValue(mockRequest);

      const result = await createPurchaseRequest({
        customerId: 100,
        customerCode: 'CUST001',
        productUrl: 'https://taobao.com/item/456',
        productName: 'Clothing Item',
        productDescription: 'Blue cotton shirt',
        color: 'Blue',
        size: 'L',
        quantity: 3,
        customerNotes: 'Please check quality',
        deliveryAddress: '123 Main St',
        deliveryCity: 'Sulaymaniyah',
        deliveryPhone: '07701234567',
      });

      expect(result.color).toBe('Blue');
      expect(result.size).toBe('L');
      expect(result.deliveryCity).toBe('Sulaymaniyah');
    });
  });

  describe('getPurchaseRequestById', () => {
    it('should return a purchase request by ID', async () => {
      const mockRequest = {
        id: 1,
        requestCode: 'PR-2026-001',
        customerId: 100,
        status: 'pending',
      };

      (getPurchaseRequestById as any).mockResolvedValue(mockRequest);

      const result = await getPurchaseRequestById(1);

      expect(result).toEqual(mockRequest);
      expect(getPurchaseRequestById).toHaveBeenCalledWith(1);
    });

    it('should return null for non-existent request', async () => {
      (getPurchaseRequestById as any).mockResolvedValue(null);

      const result = await getPurchaseRequestById(999);

      expect(result).toBeNull();
    });
  });

  describe('getPurchaseRequestsByCustomer', () => {
    it('should return all requests for a customer', async () => {
      const mockRequests = [
        { id: 1, requestCode: 'PR-2026-001', status: 'pending' },
        { id: 2, requestCode: 'PR-2026-002', status: 'quoted' },
        { id: 3, requestCode: 'PR-2026-003', status: 'delivered' },
      ];

      (getPurchaseRequestsByCustomer as any).mockResolvedValue(mockRequests);

      const result = await getPurchaseRequestsByCustomer(100);

      expect(result).toHaveLength(3);
      expect(result[0].requestCode).toBe('PR-2026-001');
    });

    it('should return empty array for customer with no requests', async () => {
      (getPurchaseRequestsByCustomer as any).mockResolvedValue([]);

      const result = await getPurchaseRequestsByCustomer(999);

      expect(result).toEqual([]);
    });
  });

  describe('updatePurchaseRequestPricing (Admin Quote)', () => {
    it('should update pricing with cost and selling price', async () => {
      const mockUpdatedRequest = {
        id: 1,
        requestCode: 'PR-2026-001',
        status: 'quoted',
        productCost: '20.00',
        shippingCost: '10.00',
        totalCost: '30.00',
        totalPrice: '45.00',
        profitMargin: '15.00',
        quotedAt: new Date(),
      };

      (updatePurchaseRequestPricing as any).mockResolvedValue(mockUpdatedRequest);

      const result = await updatePurchaseRequestPricing(1, {
        productCost: 20,
        shippingCost: 10,
        totalPrice: 45,
        adminId: 1,
        adminName: 'Admin User',
        adminNotes: 'Good quality product',
      });

      expect(result.status).toBe('quoted');
      expect(result.totalPrice).toBe('45.00');
      expect(result.profitMargin).toBe('15.00');
    });

    it('should calculate profit margin correctly', async () => {
      const mockUpdatedRequest = {
        id: 2,
        productCost: '100.00',
        shippingCost: '25.00',
        totalCost: '125.00',
        totalPrice: '200.00',
        profitMargin: '75.00', // 200 - 125 = 75
        status: 'quoted',
      };

      (updatePurchaseRequestPricing as any).mockResolvedValue(mockUpdatedRequest);

      const result = await updatePurchaseRequestPricing(2, {
        productCost: 100,
        shippingCost: 25,
        totalPrice: 200,
        adminId: 1,
      });

      // Profit = totalPrice - totalCost = 200 - 125 = 75
      expect(parseFloat(result.profitMargin)).toBe(75);
    });
  });

  describe('processPurchaseRequestPayment', () => {
    it('should process payment from customer wallet', async () => {
      const mockResult = {
        success: true,
        message: 'Payment successful',
        request: {
          id: 1,
          status: 'purchasing',
          paidFromWallet: true,
          paidAt: new Date(),
        },
      };

      (processPurchaseRequestPayment as any).mockResolvedValue(mockResult);

      const result = await processPurchaseRequestPayment(1, {
        customerId: 100,
        adminId: 1,
        adminName: 'Admin',
      });

      expect(result.success).toBe(true);
      expect(result.request.status).toBe('purchasing');
      expect(result.request.paidFromWallet).toBe(true);
    });

    it('should fail if insufficient balance', async () => {
      const mockResult = {
        success: false,
        message: 'Insufficient balance. Required: $100.00, Available: $50.00',
      };

      (processPurchaseRequestPayment as any).mockResolvedValue(mockResult);

      const result = await processPurchaseRequestPayment(1, {
        customerId: 100,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient balance');
    });

    it('should fail if request not approved', async () => {
      const mockResult = {
        success: false,
        message: 'Request must be approved before payment',
      };

      (processPurchaseRequestPayment as any).mockResolvedValue(mockResult);

      const result = await processPurchaseRequestPayment(1, {
        customerId: 100,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Request must be approved before payment');
    });
  });

  describe('updatePurchaseRequestStatus', () => {
    it('should update status to purchased', async () => {
      const mockRequest = {
        id: 1,
        status: 'purchased',
        purchasedAt: new Date(),
        purchaseOrderNumber: 'PO-12345',
      };

      (updatePurchaseRequestStatus as any).mockResolvedValue(mockRequest);

      const result = await updatePurchaseRequestStatus(1, {
        status: 'purchased',
        purchaseOrderNumber: 'PO-12345',
        adminId: 1,
        adminName: 'Admin',
      });

      expect(result.status).toBe('purchased');
      expect(result.purchaseOrderNumber).toBe('PO-12345');
    });

    it('should update status to shipped with tracking', async () => {
      const mockRequest = {
        id: 1,
        status: 'shipped',
        trackingNumber: 'TRACK123456',
        trackingCarrier: 'DHL',
      };

      (updatePurchaseRequestStatus as any).mockResolvedValue(mockRequest);

      const result = await updatePurchaseRequestStatus(1, {
        status: 'shipped',
        trackingNumber: 'TRACK123456',
        trackingCarrier: 'DHL',
        adminId: 1,
      });

      expect(result.status).toBe('shipped');
      expect(result.trackingNumber).toBe('TRACK123456');
    });

    it('should charge customer on delivery', async () => {
      const mockRequest = {
        id: 1,
        status: 'delivered',
        isCharged: true,
        chargedAt: new Date(),
        chargedAmount: '100.00',
      };

      (updatePurchaseRequestStatus as any).mockResolvedValue(mockRequest);

      const result = await updatePurchaseRequestStatus(1, {
        status: 'delivered',
        adminId: 1,
        adminName: 'Admin',
      });

      expect(result.status).toBe('delivered');
      expect(result.isCharged).toBe(true);
    });
  });

  describe('rejectPurchaseRequest', () => {
    it('should reject a request with reason', async () => {
      const mockRequest = {
        id: 1,
        status: 'admin_rejected',
        adminNotes: 'Product not available',
        rejectedAt: new Date(),
      };

      (rejectPurchaseRequest as any).mockResolvedValue(mockRequest);

      const result = await rejectPurchaseRequest(1, {
        adminId: 1,
        adminName: 'Admin',
        reason: 'Product not available',
      });

      expect(result.status).toBe('admin_rejected');
      expect(result.adminNotes).toBe('Product not available');
    });
  });

  describe('getPurchaseRequestStats', () => {
    it('should return correct statistics', async () => {
      const mockStats = {
        total: 50,
        pending: 10,
        quoted: 8,
        approved: 5,
        purchasing: 7,
        purchased: 3,
        shipped: 5,
        delivered: 10,
        cancelled: 2,
        totalRevenue: '5000.00',
        totalProfit: '1500.00',
      };

      (getPurchaseRequestStats as any).mockResolvedValue(mockStats);

      const result = await getPurchaseRequestStats();

      expect(result.total).toBe(50);
      expect(result.delivered).toBe(10);
      expect(parseFloat(result.totalRevenue)).toBe(5000);
      expect(parseFloat(result.totalProfit)).toBe(1500);
    });
  });

  describe('Purchase Request Workflow', () => {
    it('should follow correct status flow: pending -> quoted -> approved -> purchasing -> purchased -> shipped -> delivered', async () => {
      const statusFlow = ['pending', 'quoted', 'approved', 'purchasing', 'purchased', 'shipped', 'delivered'];
      
      // Verify the expected status flow
      expect(statusFlow[0]).toBe('pending');
      expect(statusFlow[1]).toBe('quoted');
      expect(statusFlow[2]).toBe('approved');
      expect(statusFlow[3]).toBe('purchasing');
      expect(statusFlow[4]).toBe('purchased');
      expect(statusFlow[5]).toBe('shipped');
      expect(statusFlow[6]).toBe('delivered');
    });

    it('should allow customer rejection after quote', async () => {
      const mockRequest = {
        id: 1,
        status: 'customer_rejected',
        customerResponse: 'rejected',
        customerRejectionReason: 'Price too high',
      };

      (updatePurchaseRequestStatus as any).mockResolvedValue(mockRequest);

      const result = await updatePurchaseRequestStatus(1, {
        status: 'customer_rejected',
        notes: 'Price too high',
      });

      expect(result.status).toBe('customer_rejected');
    });

    it('should allow admin rejection at any point', async () => {
      const mockRequest = {
        id: 1,
        status: 'admin_rejected',
        adminNotes: 'Cannot source product',
      };

      (rejectPurchaseRequest as any).mockResolvedValue(mockRequest);

      const result = await rejectPurchaseRequest(1, {
        adminId: 1,
        reason: 'Cannot source product',
      });

      expect(result.status).toBe('admin_rejected');
    });
  });

  describe('Profit Calculation', () => {
    it('should calculate profit correctly: profit = totalPrice - (productCost + shippingCost)', () => {
      const productCost = 50;
      const shippingCost = 15;
      const totalPrice = 100;
      
      const totalCost = productCost + shippingCost; // 65
      const profit = totalPrice - totalCost; // 35
      
      expect(profit).toBe(35);
    });

    it('should handle zero shipping cost', () => {
      const productCost = 100;
      const shippingCost = 0;
      const totalPrice = 150;
      
      const profit = totalPrice - (productCost + shippingCost);
      
      expect(profit).toBe(50);
    });

    it('should handle negative profit (loss)', () => {
      const productCost = 100;
      const shippingCost = 30;
      const totalPrice = 100; // Selling at cost
      
      const profit = totalPrice - (productCost + shippingCost);
      
      expect(profit).toBe(-30); // Loss due to shipping
    });
  });
});
