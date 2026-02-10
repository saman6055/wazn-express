import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function migrateCustomerAccounts() {
  console.log('🔄 Starting customerAccounts migration...');
  
  const connection = await mysql.createConnection(DATABASE_URL);

  try {
    // Get all unique accountIds from ledgerTransactions
    const [accounts] = await connection.execute(`
      SELECT DISTINCT accountId FROM ledgerTransactions
    `);
    
    console.log(`Found ${accounts.length} unique accounts in ledgerTransactions`);

    for (const row of accounts) {
      const accountId = row.accountId;
      
      // Check if customerAccount already exists
      const [existing] = await connection.execute(`
        SELECT id FROM customerAccounts WHERE id = ?
      `, [accountId]);

      if (existing.length > 0) {
        console.log(`Account ${accountId} already exists, updating balance...`);
        
        // Calculate balance from ledgerTransactions
        const [balanceResult] = await connection.execute(`
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
          WHERE accountId = ?
        `, [accountId]);

        const balanceData = balanceResult[0];
        const currentBalance = balanceData?.balance || 0;
        const packageDebt = balanceData?.packageDebt || 0;
        const fullPackageDebt = balanceData?.fullPackageDebt || 0;
        const purchaseRequestDebt = balanceData?.purchaseRequestDebt || 0;
        const commissionDebt = balanceData?.commissionDebt || 0;
        const serviceDebt = balanceData?.serviceDebt || 0;
        const creditBalance = balanceData?.creditBalance || 0;

        // Update customerAccounts
        await connection.execute(`
          UPDATE customerAccounts SET
            currentBalanceUsd = ?,
            packageDebtUsd = ?,
            fullPackageDebtUsd = ?,
            purchaseRequestDebtUsd = ?,
            commissionDebtUsd = ?,
            serviceDebtUsd = ?,
            creditBalanceUsd = ?,
            updatedAt = NOW()
          WHERE id = ?
        `, [currentBalance, packageDebt, fullPackageDebt, purchaseRequestDebt, commissionDebt, serviceDebt, creditBalance, accountId]);

        console.log(`✅ Updated customerAccount ${accountId} with balance $${currentBalance}`);
        continue;
      }

      // Get customerId (should be same as accountId)
      const customerId = accountId;

      // Calculate balance from ledgerTransactions
      const [balanceResult] = await connection.execute(`
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
        WHERE accountId = ?
      `, [accountId]);

      const balanceData = balanceResult[0];
      const currentBalance = balanceData?.balance || 0;
      const packageDebt = balanceData?.packageDebt || 0;
      const fullPackageDebt = balanceData?.fullPackageDebt || 0;
      const purchaseRequestDebt = balanceData?.purchaseRequestDebt || 0;
      const commissionDebt = balanceData?.commissionDebt || 0;
      const serviceDebt = balanceData?.serviceDebt || 0;
      const creditBalance = balanceData?.creditBalance || 0;

      // Generate account number
      const accountNumber = `ACC-${String(accountId).padStart(15, '0')}`;

      // Insert into customerAccounts
      await connection.execute(`
        INSERT INTO customerAccounts (
          id, customerId, accountNumber, currentBalanceUsd, currentBalanceIqd,
          packageDebtUsd, fullPackageDebtUsd, purchaseRequestDebtUsd,
          commissionDebtUsd, serviceDebtUsd, creditBalanceUsd,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [accountId, customerId, accountNumber, currentBalance, packageDebt, fullPackageDebt, purchaseRequestDebt, commissionDebt, serviceDebt, creditBalance]);

      console.log(`✅ Created customerAccount for customer ${customerId} (account ${accountId}) with balance $${currentBalance}`);
    }

    console.log('✅ Migration completed successfully!');
    
    // Show summary
    const [summary] = await connection.execute(`
      SELECT 
        COUNT(*) as totalAccounts,
        SUM(CAST(currentBalanceUsd AS DECIMAL(12,2))) as totalDebt
      FROM customerAccounts
      WHERE CAST(currentBalanceUsd AS DECIMAL(12,2)) > 0
    `);
    
    console.log(`\n📊 Summary:`);
    console.log(`Total accounts with debt: ${summary[0].totalAccounts}`);
    console.log(`Total debt: $${summary[0].totalDebt}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

migrateCustomerAccounts().catch(console.error);
