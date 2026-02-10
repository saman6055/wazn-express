import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';
import { eq, sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function migrateCustomerAccounts() {
  console.log('🔄 Starting customerAccounts migration...');
  
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection, { schema, mode: 'default' });

  try {
    // Get all unique accountIds from ledgerTransactions
    const accountsResult = await db.execute(sql`
      SELECT DISTINCT accountId FROM ledgerTransactions
    `);
    
    console.log(`Found ${accountsResult[0].length} unique accounts in ledgerTransactions`);

    for (const row of accountsResult[0]) {
      const accountId = row.accountId;
      
      // Check if customerAccount already exists
      const existing = await db.execute(sql`
        SELECT id FROM customerAccounts WHERE id = ${accountId}
      `);

      if (existing[0].length > 0) {
        console.log(`Account ${accountId} already exists, skipping...`);
        continue;
      }

      // Get customerId from ledgerTransactions (should be same as accountId in our system)
      const customerIdResult = await db.execute(sql`
        SELECT accountId as customerId FROM ledgerTransactions WHERE accountId = ${accountId} LIMIT 1
      `);
      
      const customerId = customerIdResult[0][0]?.customerId;
      
      if (!customerId) {
        console.log(`No customerId found for account ${accountId}, skipping...`);
        continue;
      }

      // Calculate balance from ledgerTransactions
      const balanceResult = await db.execute(sql`
        SELECT 
          SUM(CASE 
            WHEN transactionType LIKE 'DEBIT%' THEN CAST(amountUsd AS DECIMAL(12,2))
            WHEN transactionType LIKE 'CREDIT%' THEN -CAST(amountUsd AS DECIMAL(12,2))
            WHEN transactionType = 'ADJUSTMENT_DEBIT' THEN CAST(amountUsd AS DECIMAL(12,2))
            WHEN transactionType = 'ADJUSTMENT_CREDIT' THEN -CAST(amountUsd AS DECIMAL(12,2))
            ELSE 0
          END) as balance,
          SUM(CASE WHEN transactionType = 'DEBIT_PACKAGE' THEN CAST(amountUsd AS DECIMAL(12,2)) ELSE 0 END) as packageDebt,
          SUM(CASE WHEN transactionType = 'DEBIT_FULL_PACKAGE' THEN CAST(amountUsd AS DECIMAL(12,2)) ELSE 0 END) as fullPackageDebt,
          SUM(CASE WHEN transactionType = 'DEBIT_PURCHASE_REQUEST' THEN CAST(amountUsd AS DECIMAL(12,2)) ELSE 0 END) as purchaseRequestDebt,
          SUM(CASE WHEN transactionType = 'DEBIT_COMMISSION' THEN CAST(amountUsd AS DECIMAL(12,2)) ELSE 0 END) as commissionDebt,
          SUM(CASE WHEN transactionType = 'DEBIT_SERVICE' THEN CAST(amountUsd AS DECIMAL(12,2)) ELSE 0 END) as serviceDebt,
          SUM(CASE WHEN transactionType LIKE 'CREDIT%' THEN CAST(amountUsd AS DECIMAL(12,2)) ELSE 0 END) as creditBalance
        FROM ledgerTransactions
        WHERE accountId = ${accountId}
      `);

      const balanceData = balanceResult[0][0];
      const currentBalance = balanceData?.balance || 0;
      const packageDebt = balanceData?.packageDebt || 0;
      const fullPackageDebt = balanceData?.fullPackageDebt || 0;
      const purchaseRequestDebt = balanceData?.purchaseRequestDebt || 0;
      const commissionDebt = balanceData?.commissionDebt || 0;
      const serviceDebt = balanceData?.serviceDebt || 0;
      const creditBalance = balanceData?.creditBalance || 0;

      // Insert into customerAccounts
      await db.execute(sql`
        INSERT INTO customerAccounts (
          id, customerId, currentBalanceUsd, currentBalanceIqd,
          packageDebtUsd, fullPackageDebtUsd, purchaseRequestDebtUsd,
          commissionDebtUsd, serviceDebtUsd, creditBalanceUsd,
          createdAt, updatedAt
        ) VALUES (
          ${accountId}, ${customerId}, ${currentBalance}, 0,
          ${packageDebt}, ${fullPackageDebt}, ${purchaseRequestDebt},
          ${commissionDebt}, ${serviceDebt}, ${creditBalance},
          NOW(), NOW()
        )
      `);

      console.log(`✅ Created customerAccount for customer ${customerId} (account ${accountId}) with balance $${currentBalance}`);
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

migrateCustomerAccounts().catch(console.error);
