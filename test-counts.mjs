import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { count } from 'drizzle-orm';
import * as schema from './drizzle/schema.js';

const DATABASE_URL = process.env.DATABASE_URL;

async function testCounts() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection, { schema, mode: 'default' });

  try {
    const [customersCount] = await db.select({ count: count() }).from(schema.customers);
    const [packagesCount] = await db.select({ count: count() }).from(schema.packages);
    const [batchesCount] = await db.select({ count: count() }).from(schema.batches);
    const [ledgerCount] = await db.select({ count: count() }).from(schema.ledgerEntries);
    const [invoicesCount] = await db.select({ count: count() }).from(schema.invoices);
    const [paymentsCount] = await db.select({ count: count() }).from(schema.paymentRecords);

    console.log('Database Counts:');
    console.log('  Customers:', customersCount?.count || 0);
    console.log('  Packages:', packagesCount?.count || 0);
    console.log('  Batches:', batchesCount?.count || 0);
    console.log('  Ledger Entries:', ledgerCount?.count || 0);
    console.log('  Invoices:', invoicesCount?.count || 0);
    console.log('  Payments:', paymentsCount?.count || 0);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

testCounts();
