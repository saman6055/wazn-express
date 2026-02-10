import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Check table structure
  console.log('=== fullPackageOrders columns ===');
  const [cols] = await connection.query('DESCRIBE fullPackageOrders');
  cols.forEach(c => console.log(`  ${c.Field} (${c.Type}) ${c.Null === 'YES' ? 'NULL' : 'NOT NULL'}`));
  
  // Check batch data
  console.log('\n=== Orders with batchId ===');
  const [orders] = await connection.query(
    'SELECT id, orderCode, productName, orderType, batchId, status FROM fullPackageOrders ORDER BY createdAt DESC LIMIT 20'
  );
  orders.forEach(o => console.log(`  #${o.id} code=${o.orderCode} type=${o.orderType} batchId=${o.batchId} status=${o.status}`));
  
  // Check batches table
  console.log('\n=== Batches ===');
  const [batches] = await connection.query('SELECT id, name, batchType, status FROM batches LIMIT 20');
  batches.forEach(b => console.log(`  #${b.id} name=${b.name} type=${b.batchType} status=${b.status}`));
  
  // Check if any orders have batchId set
  console.log('\n=== Batch assignment stats ===');
  const [stats] = await connection.query(
    'SELECT orderType, COUNT(*) as total, SUM(CASE WHEN batchId IS NOT NULL THEN 1 ELSE 0 END) as withBatch, SUM(CASE WHEN batchId IS NULL THEN 1 ELSE 0 END) as withoutBatch FROM fullPackageOrders GROUP BY orderType'
  );
  stats.forEach(s => console.log(`  ${s.orderType}: total=${s.total} withBatch=${s.withBatch} withoutBatch=${s.withoutBatch}`));
  
  await connection.end();
}

main().catch(console.error);
