import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';
import { hasDb } from "./testEnv";

describe.skipIf(!hasDb())('Batch Operations', () => {
  let testWarehouseId: number;
  let testCountryId: number;

  beforeAll(async () => {
    // Get a warehouse
    const warehouses = await db.getAllWarehouses();
    if (warehouses.length > 0) {
      testWarehouseId = warehouses[0].id;
    } else {
      throw new Error('No warehouses found for testing');
    }

    // Get a destination country
    const countries = await db.getDestinationCountries();
    if (countries.length > 0) {
      testCountryId = countries[0].id;
    } else {
      throw new Error('No destination countries found for testing');
    }
  });

  it('should create a batch successfully', async () => {
    const batchCode = `TEST-VITEST-${Date.now()}`;
    
    const batch = await db.createBatch({
      batchCode,
      originWarehouseId: testWarehouseId,
      destinationCountryId: testCountryId,
      shippingType: 'air_regular',
      status: 'preparing',
      createdById: 1,
    });

    expect(batch).toBeDefined();
    expect(batch.id).toBeGreaterThan(0);
    expect(batch.batchCode).toBe(batchCode);
    expect(batch.status).toBe('preparing');
    
    console.log('Created batch:', batch);
  });

  it('should list all batches', async () => {
    const result = await db.getAllBatches();
    const batches = result.data;
    
    expect(batches).toBeDefined();
    expect(Array.isArray(batches)).toBe(true);
    expect(batches.length).toBeGreaterThan(0);
    
    console.log('Total batches:', batches.length);
  });

  it('should get active batches', async () => {
    const activeBatches = await db.getActiveBatches();
    
    expect(activeBatches).toBeDefined();
    expect(Array.isArray(activeBatches)).toBe(true);
    
    // All should have active status
    for (const batch of activeBatches) {
      expect(['preparing', 'in_transit', 'arrived', 'customs']).toContain(batch.status);
    }
    
    console.log('Active batches:', activeBatches.length);
  });
});
