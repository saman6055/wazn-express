import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  console.log('Populating dailyFinancialSummary from ledgerTransactions...');
  
  // Get revenue by date from ledgerTransactions (DEBIT entries = revenue)
  const [revenueRows] = await connection.execute(`
    SELECT 
      DATE(createdAt) as summaryDate,
      SUM(CASE WHEN transactionType LIKE 'DEBIT_%' THEN amountUsd ELSE 0 END) as totalRevenue,
      COUNT(CASE WHEN transactionType = 'DEBIT_PACKAGE' THEN 1 END) as packagesDelivered
    FROM ledgerTransactions
    GROUP BY DATE(createdAt)
  `);
  
  console.log(`Found ${revenueRows.length} days with revenue data`);
  
  // Get expenses by date
  const [expenseRows] = await connection.execute(`
    SELECT 
      DATE(expenseDate) as summaryDate,
      SUM(amount) as totalExpenses
    FROM expenses
    GROUP BY DATE(expenseDate)
  `);
  
  console.log(`Found ${expenseRows.length} days with expense data`);
  
  // Merge revenue and expenses by date
  const summaryMap = new Map();
  
  for (const row of revenueRows) {
    const dateStr = row.summaryDate.toISOString().split('T')[0];
    summaryMap.set(dateStr, {
      summaryDate: dateStr,
      totalRevenue: Number(row.totalRevenue || 0),
      totalExpenses: 0,
      packagesDelivered: Number(row.packagesDelivered || 0),
    });
  }
  
  for (const row of expenseRows) {
    const dateStr = row.summaryDate.toISOString().split('T')[0];
    if (summaryMap.has(dateStr)) {
      summaryMap.get(dateStr).totalExpenses = Number(row.totalExpenses || 0);
    } else {
      summaryMap.set(dateStr, {
        summaryDate: dateStr,
        totalRevenue: 0,
        totalExpenses: Number(row.totalExpenses || 0),
        packagesDelivered: 0,
      });
    }
  }
  
  // Insert or update dailyFinancialSummary
  for (const [dateStr, data] of summaryMap) {
    const grossProfit = data.totalRevenue - data.totalExpenses;
    const netProfit = grossProfit;
    const cashIn = data.totalRevenue;
    const cashOut = data.totalExpenses;
    const netCashFlow = cashIn - cashOut;
    
    await connection.execute(`
      INSERT INTO dailyFinancialSummary 
        (summaryDate, totalRevenue, totalExpenses, grossProfit, netProfit, cashIn, cashOut, netCashFlow, packagesDelivered, fullPackagesSold, invoicesIssued, paymentsReceived, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        totalRevenue = VALUES(totalRevenue),
        totalExpenses = VALUES(totalExpenses),
        grossProfit = VALUES(grossProfit),
        netProfit = VALUES(netProfit),
        cashIn = VALUES(cashIn),
        cashOut = VALUES(cashOut),
        netCashFlow = VALUES(netCashFlow),
        packagesDelivered = VALUES(packagesDelivered),
        updatedAt = NOW()
    `, [dateStr, data.totalRevenue, data.totalExpenses, grossProfit, netProfit, cashIn, cashOut, netCashFlow, data.packagesDelivered]);
    
    console.log(`Inserted/Updated summary for ${dateStr}: Revenue=$${data.totalRevenue}, Expenses=$${data.totalExpenses}`);
  }
  
  console.log('Done!');
  await connection.end();
}

main().catch(console.error);
