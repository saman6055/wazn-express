import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Expected tables from migrations.ts
const expectedTables = [
  'activityAlerts', 'auditLogs', 'backups', 'batchCustomerPricing', 'batchPricingTiers',
  'batches', 'blogPosts', 'cashAccounts', 'cashTransactions', 'chatMessages',
  'companyDebts', 'countries', 'creditAdjustments', 'currencies', 'customerAccounts',
  'customerAddresses', 'customerCodePrefixes', 'customerMessages', 'customerNotificationPrefs',
  'customerNotifications', 'customers', 'dailyFinancialSummary', 'debtPayments', 'deletionLogs',
  'emailTemplates', 'exchangeRates', 'expenseCategories', 'expenses', 'extraServices',
  'financialPeriods', 'fullPackageOrders', 'fullPackageStatusHistory', 'invoiceTemplates',
  'invoices', 'ipWhitelist', 'labelTemplates', 'ledgerTransactions', 'notificationLogs',
  'notificationSettings', 'notificationTemplates', 'packageClaimRequests', 'packageQrCodes',
  'packageScans', 'packageStatusHistory', 'packages', 'partnerTransactions', 'partners',
  'paymentRecords', 'paymentReminders', 'permissions', 'pricingRules', 'productCategories',
  'revenueRecords', 'scanDevices', 'scanHistory', 'scheduledTasksLog', 'serviceTypes',
  'stockCategories', 'stockMovements', 'stockProducts', 'stockPurchaseItems', 'stockPurchases',
  'stockSaleItems', 'stockSales', 'subPermissions', 'suppliers', 'supportChats',
  'systemSettings', 'taxRates', 'users', 'vipCustomers', 'warehouses'
];

// Table name mapping (camelCase to snake_case or actual DB names)
const tableNameMap = {
  'activityAlerts': 'activity_alerts',
  'auditLogs': 'audit_logs',
  'batchCustomerPricing': 'batch_customer_pricing',
  'batchPricingTiers': 'batch_pricing_tiers',
  'blogPosts': 'blog_posts',
  'cashAccounts': 'cash_accounts',
  'cashTransactions': 'cash_transactions',
  'chatMessages': 'chat_messages',
  'companyDebts': 'company_debts',
  'creditAdjustments': 'credit_adjustments',
  'customerAccounts': 'customer_accounts',
  'customerAddresses': 'customer_addresses',
  'customerCodePrefixes': 'customer_code_prefixes',
  'customerMessages': 'customer_messages',
  'customerNotificationPrefs': 'customer_notification_prefs',
  'customerNotifications': 'customer_notifications',
  'dailyFinancialSummary': 'daily_financial_summary',
  'debtPayments': 'debt_payments',
  'deletionLogs': 'deletion_logs',
  'emailTemplates': 'email_templates',
  'exchangeRates': 'exchange_rates',
  'expenseCategories': 'expenseCategories',
  'extraServices': 'extra_services',
  'financialPeriods': 'financial_periods',
  'fullPackageOrders': 'full_package_orders',
  'fullPackageStatusHistory': 'full_package_status_history',
  'invoiceTemplates': 'invoiceTemplates',
  'ipWhitelist': 'ip_whitelist',
  'labelTemplates': 'labelTemplates',
  'ledgerTransactions': 'ledger_transactions',
  'notificationLogs': 'notification_logs',
  'notificationSettings': 'notification_settings',
  'notificationTemplates': 'notification_templates',
  'packageClaimRequests': 'package_claim_requests',
  'packageQrCodes': 'package_qr_codes',
  'packageScans': 'package_scans',
  'packageStatusHistory': 'package_status_history',
  'partnerTransactions': 'partner_transactions',
  'paymentRecords': 'payment_records',
  'paymentReminders': 'payment_reminders',
  'pricingRules': 'pricing_rules',
  'productCategories': 'productCategories',
  'revenueRecords': 'revenue_records',
  'scanDevices': 'scan_devices',
  'scanHistory': 'scan_history',
  'scheduledTasksLog': 'scheduled_tasks_log',
  'serviceTypes': 'serviceTypes',
  'stockCategories': 'stockCategories',
  'stockMovements': 'stock_movements',
  'stockProducts': 'stock_products',
  'stockPurchaseItems': 'stock_purchase_items',
  'stockPurchases': 'stock_purchases',
  'stockSaleItems': 'stock_sale_items',
  'stockSales': 'stock_sales',
  'subPermissions': 'sub_permissions',
  'supportChats': 'support_chats',
  'taxRates': 'tax_rates',
  'vipCustomers': 'vip_customers'
};

async function checkTables() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // Get all existing tables
    const [rows] = await connection.execute(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );
    
    const existingTables = rows.map(r => r.TABLE_NAME.toLowerCase());
    console.log(`\n📊 Found ${existingTables.length} tables in database\n`);
    console.log('Existing tables:', existingTables.sort().join(', '));
    
    // Check which expected tables are missing
    const missingTables = [];
    
    for (const table of expectedTables) {
      const dbName = tableNameMap[table] || table;
      const exists = existingTables.includes(dbName.toLowerCase()) || 
                     existingTables.includes(table.toLowerCase());
      
      if (!exists) {
        missingTables.push({ expected: table, dbName });
      }
    }
    
    console.log(`\n❌ Missing ${missingTables.length} tables:`);
    missingTables.forEach(t => console.log(`  - ${t.expected} (DB name: ${t.dbName})`));
    
    // Check if batches table exists specifically
    const batchesExists = existingTables.includes('batches');
    console.log(`\n🔍 Batches table exists: ${batchesExists ? '✅ YES' : '❌ NO'}`);
    
    if (batchesExists) {
      // Check batches table structure
      const [columns] = await connection.execute('DESCRIBE batches');
      console.log('\n📋 Batches table structure:');
      columns.forEach(col => console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key ? `(${col.Key})` : ''}`));
    }
    
  } finally {
    await connection.end();
  }
}

checkTables().catch(console.error);
