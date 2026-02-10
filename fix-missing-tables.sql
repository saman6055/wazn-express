-- Fix Missing Tables for Wazn Express
-- Created: 2026-02-02

-- 1. Batch Pricing Tiers (نرخدانی پلەیی)
CREATE TABLE IF NOT EXISTS `batchPricingTiers` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `batchId` int NOT NULL,
  `minValue` decimal(10, 4) NOT NULL,
  `maxValue` decimal(10, 4),
  `pricePerUnit` decimal(10, 2) NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Batch Customer Pricing (نرخی تایبەت بۆ کڕیار)
CREATE TABLE IF NOT EXISTS `batchCustomerPricing` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `batchId` int NOT NULL,
  `customerId` int NOT NULL,
  `pricePerKg` decimal(10, 2),
  `pricePerCbm` decimal(10, 2),
  `notes` text,
  `createdById` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Activity Alerts
CREATE TABLE IF NOT EXISTS `activityAlerts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `entityType` varchar(50) NOT NULL,
  `entityId` int NOT NULL,
  `alertType` varchar(50) NOT NULL,
  `alertLevel` varchar(20) NOT NULL DEFAULT 'info',
  `message` text NOT NULL,
  `isRead` boolean NOT NULL DEFAULT false,
  `readAt` timestamp,
  `readById` int,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Email Templates
CREATE TABLE IF NOT EXISTS `emailTemplates` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(100) NOT NULL UNIQUE,
  `subject` varchar(500) NOT NULL,
  `bodyHtml` text NOT NULL,
  `bodyText` text,
  `variables` json,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. Stock Categories
CREATE TABLE IF NOT EXISTS `stockCategories` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(200) NOT NULL,
  `description` text,
  `parentId` int,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Stock Products
CREATE TABLE IF NOT EXISTS `stockProducts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `sku` varchar(100) NOT NULL UNIQUE,
  `name` varchar(255) NOT NULL,
  `description` text,
  `categoryId` int,
  `unit` varchar(50) NOT NULL DEFAULT 'piece',
  `costPrice` decimal(10, 2),
  `sellPrice` decimal(10, 2),
  `quantity` int NOT NULL DEFAULT 0,
  `minQuantity` int NOT NULL DEFAULT 0,
  `warehouseId` int,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. Stock Purchases
CREATE TABLE IF NOT EXISTS `stockPurchases` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `purchaseNumber` varchar(100) NOT NULL UNIQUE,
  `supplierId` int,
  `totalAmount` decimal(12, 2) NOT NULL DEFAULT 0,
  `paidAmount` decimal(12, 2) NOT NULL DEFAULT 0,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `purchaseDate` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text,
  `createdById` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 8. Stock Purchase Items
CREATE TABLE IF NOT EXISTS `stockPurchaseItems` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `purchaseId` int NOT NULL,
  `productId` int NOT NULL,
  `quantity` int NOT NULL,
  `unitPrice` decimal(10, 2) NOT NULL,
  `totalPrice` decimal(12, 2) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Stock Sales
CREATE TABLE IF NOT EXISTS `stockSales` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `saleNumber` varchar(100) NOT NULL UNIQUE,
  `customerId` int,
  `totalAmount` decimal(12, 2) NOT NULL DEFAULT 0,
  `paidAmount` decimal(12, 2) NOT NULL DEFAULT 0,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `saleDate` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text,
  `createdById` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 10. Stock Sale Items
CREATE TABLE IF NOT EXISTS `stockSaleItems` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `saleId` int NOT NULL,
  `productId` int NOT NULL,
  `quantity` int NOT NULL,
  `unitPrice` decimal(10, 2) NOT NULL,
  `totalPrice` decimal(12, 2) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Stock Movements (for tracking inventory changes)
CREATE TABLE IF NOT EXISTS `stockMovements` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `productId` int NOT NULL,
  `movementType` varchar(50) NOT NULL,
  `quantity` int NOT NULL,
  `referenceType` varchar(50),
  `referenceId` int,
  `notes` text,
  `createdById` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
