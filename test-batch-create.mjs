import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

async function testBatchCreation() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('Testing batch creation...\n');
    
    // Get warehouse
    const [warehouses] = await connection.execute('SELECT id, nameEn FROM warehouses LIMIT 1');
    console.log('Warehouse:', warehouses[0]);
    
    // Get destination country
    const [countries] = await connection.execute('SELECT id, nameEn FROM countries WHERE isDestination = 1 LIMIT 1');
    console.log('Destination Country:', countries[0]);
    
    if (!warehouses[0] || !countries[0]) {
      console.log('Missing warehouse or destination country!');
      return;
    }
    
    // Try to insert a batch directly
    const batchCode = `TEST-DIRECT-${Date.now()}`;
    console.log('\nInserting batch with code:', batchCode);
    
    const [result] = await connection.execute(
      `INSERT INTO batches (batchCode, originWarehouseId, destinationCountryId, shippingType, status, totalPackages, createdById, createdAt, updatedAt, useTieredPricing)
       VALUES (?, ?, ?, 'air_regular', 'preparing', 0, 1, NOW(), NOW(), 0)`,
      [batchCode, warehouses[0].id, countries[0].id]
    );
    
    console.log('Insert result:', result);
    console.log('Inserted ID:', result.insertId);
    
    // Verify it was inserted
    const [batches] = await connection.execute('SELECT * FROM batches WHERE id = ?', [result.insertId]);
    console.log('\nVerification - Batch found:', batches[0] ? 'YES' : 'NO');
    if (batches[0]) {
      console.log('Batch data:', JSON.stringify(batches[0], null, 2));
    }
    
    // Count total batches
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM batches');
    console.log('\nTotal batches in database:', countResult[0].count);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await connection.end();
  }
}

testBatchCreation();
