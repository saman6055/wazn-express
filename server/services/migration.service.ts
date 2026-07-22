// Migration script to create missing tables
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export async function runMigration(): Promise<{ success: boolean; message: string; tables: string[] }> {
  const db = await getDb();
  if (!db) {
    return { success: false, message: "Database not available", tables: [] };
  }

  const createdTables: string[] = [];
  const errors: string[] = [];

  const tableDefinitions = [
    {
      name: "batchPricingTiers",
      sql: `CREATE TABLE IF NOT EXISTS \`batchPricingTiers\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`batchId\` int NOT NULL,
        \`minWeight\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`maxWeight\` decimal(10,2),
        \`pricePerKg\` decimal(10,2) NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`batchPricingTiers_batchId_idx\` (\`batchId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
      name: "batchCustomerPricing",
      sql: `CREATE TABLE IF NOT EXISTS \`batchCustomerPricing\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`batchId\` int NOT NULL,
        \`customerId\` int NOT NULL,
        \`pricePerKg\` decimal(10,2) NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`batchCustomerPricing_batch_customer_unique\` (\`batchId\`, \`customerId\`),
        KEY \`batchCustomerPricing_batchId_idx\` (\`batchId\`),
        KEY \`batchCustomerPricing_customerId_idx\` (\`customerId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
      name: "activityAlerts",
      sql: `CREATE TABLE IF NOT EXISTS \`activityAlerts\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`type\` varchar(50) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`message\` text,
        \`entityType\` varchar(50),
        \`entityId\` int,
        \`isRead\` tinyint(1) NOT NULL DEFAULT '0',
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`activityAlerts_type_idx\` (\`type\`),
        KEY \`activityAlerts_isRead_idx\` (\`isRead\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
      name: "emailTemplates",
      sql: `CREATE TABLE IF NOT EXISTS \`emailTemplates\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(100) NOT NULL,
        \`subject\` varchar(255) NOT NULL,
        \`body\` text NOT NULL,
        \`variables\` json,
        \`isActive\` tinyint(1) NOT NULL DEFAULT '1',
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`emailTemplates_name_unique\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
      name: "stockCategories",
      sql: `CREATE TABLE IF NOT EXISTS \`stockCategories\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(100) NOT NULL,
        \`description\` text,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
      name: "stockProducts",
      sql: `CREATE TABLE IF NOT EXISTS \`stockProducts\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`categoryId\` int,
        \`name\` varchar(255) NOT NULL,
        \`sku\` varchar(100),
        \`description\` text,
        \`unit\` varchar(50) NOT NULL DEFAULT 'piece',
        \`currentStock\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`minStock\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`costPrice\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`salePrice\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`stockProducts_categoryId_idx\` (\`categoryId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
      name: "stockPurchases",
      sql: `CREATE TABLE IF NOT EXISTS \`stockPurchases\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`supplierId\` int,
        \`invoiceNumber\` varchar(100),
        \`totalAmount\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`paidAmount\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`status\` varchar(50) NOT NULL DEFAULT 'pending',
        \`notes\` text,
        \`purchaseDate\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
      name: "stockPurchaseItems",
      sql: `CREATE TABLE IF NOT EXISTS \`stockPurchaseItems\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`purchaseId\` int NOT NULL,
        \`productId\` int NOT NULL,
        \`quantity\` decimal(10,2) NOT NULL,
        \`unitPrice\` decimal(10,2) NOT NULL,
        \`totalPrice\` decimal(10,2) NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`stockPurchaseItems_purchaseId_idx\` (\`purchaseId\`),
        KEY \`stockPurchaseItems_productId_idx\` (\`productId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
      name: "stockSales",
      sql: `CREATE TABLE IF NOT EXISTS \`stockSales\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`customerId\` int,
        \`invoiceNumber\` varchar(100),
        \`totalAmount\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`paidAmount\` decimal(10,2) NOT NULL DEFAULT '0.00',
        \`status\` varchar(50) NOT NULL DEFAULT 'pending',
        \`notes\` text,
        \`saleDate\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
      name: "stockSaleItems",
      sql: `CREATE TABLE IF NOT EXISTS \`stockSaleItems\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`saleId\` int NOT NULL,
        \`productId\` int NOT NULL,
        \`quantity\` decimal(10,2) NOT NULL,
        \`unitPrice\` decimal(10,2) NOT NULL,
        \`totalPrice\` decimal(10,2) NOT NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`stockSaleItems_saleId_idx\` (\`saleId\`),
        KEY \`stockSaleItems_productId_idx\` (\`productId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    {
      name: "stockMovements",
      sql: `CREATE TABLE IF NOT EXISTS \`stockMovements\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`productId\` int NOT NULL,
        \`type\` varchar(50) NOT NULL,
        \`quantity\` decimal(10,2) NOT NULL,
        \`referenceType\` varchar(50),
        \`referenceId\` int,
        \`notes\` text,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`stockMovements_productId_idx\` (\`productId\`),
        KEY \`stockMovements_type_idx\` (\`type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    },
    // ---- Customer Portal Center (this list runs at server startup — any
    // table added to _core/migrations.ts must be mirrored here too) ----
    {
      name: "customerActivityLog",
      sql: `CREATE TABLE IF NOT EXISTS \`customerActivityLog\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`customerId\` INT NOT NULL,
        \`action\` VARCHAR(60) NOT NULL,
        \`category\` ENUM('auth', 'navigation', 'declaration', 'claim', 'message', 'search', 'profile', 'other') NOT NULL DEFAULT 'other',
        \`entityType\` VARCHAR(50),
        \`entityId\` INT,
        \`path\` VARCHAR(255),
        \`detail\` VARCHAR(500),
        \`metadata\` JSON,
        \`ipAddress\` VARCHAR(64),
        \`userAgent\` VARCHAR(400),
        \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_cal_customer\` (\`customerId\`),
        KEY \`idx_cal_action\` (\`action\`),
        KEY \`idx_cal_created\` (\`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "customerAdminNotes",
      sql: `CREATE TABLE IF NOT EXISTS \`customerAdminNotes\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`customerId\` INT NOT NULL,
        \`note\` VARCHAR(2000) NOT NULL,
        \`createdById\` INT NOT NULL,
        \`createdByName\` VARCHAR(255),
        \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_can_customer\` (\`customerId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "deliveryRatings",
      sql: `CREATE TABLE IF NOT EXISTS \`deliveryRatings\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`customerId\` INT NOT NULL,
        \`packageId\` INT NOT NULL,
        \`rating\` INT NOT NULL,
        \`comment\` VARCHAR(1000),
        \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_dr_package\` (\`packageId\`),
        KEY \`idx_dr_customer\` (\`customerId\`),
        KEY \`idx_dr_rating\` (\`rating\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "yuanExchangeOrders",
      sql: `CREATE TABLE IF NOT EXISTS \`yuanExchangeOrders\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`customerId\` INT NOT NULL,
        \`usdAmount\` DECIMAL(12,2) NOT NULL,
        \`cnyAmount\` DECIMAL(12,2) NOT NULL,
        \`rate\` DECIMAL(10,4) NOT NULL,
        \`status\` ENUM('pending', 'processing', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
        \`customerNote\` VARCHAR(1000),
        \`adminNote\` VARCHAR(1000),
        \`handledById\` INT,
        \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_yeo_customer\` (\`customerId\`),
        KEY \`idx_yeo_status\` (\`status\`),
        KEY \`idx_yeo_created\` (\`createdAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    }
  ];

  for (const table of tableDefinitions) {
    try {
      await db.execute(sql.raw(table.sql));
      createdTables.push(table.name);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes("already exists")) {
        errors.push(`${table.name}: ${msg}`);
      } else {
        createdTables.push(`${table.name} (already exists)`);
      }
    }
  }

  if (errors.length > 0) {
    return { 
      success: false, 
      message: `Migration completed with errors: ${errors.join(", ")}`, 
      tables: createdTables 
    };
  }

  return { 
    success: true, 
    message: "All tables created successfully", 
    tables: createdTables 
  };
}
