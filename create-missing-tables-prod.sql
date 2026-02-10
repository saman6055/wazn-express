-- Create missing tables for Wazn Express Production Database

-- 1. batchPricingTiers
CREATE TABLE IF NOT EXISTS `batchPricingTiers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `batchId` int NOT NULL,
  `minWeight` decimal(10,2) NOT NULL DEFAULT '0.00',
  `maxWeight` decimal(10,2),
  `pricePerKg` decimal(10,2) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `batchPricingTiers_batchId_idx` (`batchId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. batchCustomerPricing
CREATE TABLE IF NOT EXISTS `batchCustomerPricing` (
  `id` int NOT NULL AUTO_INCREMENT,
  `batchId` int NOT NULL,
  `customerId` int NOT NULL,
  `pricePerKg` decimal(10,2) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `batchCustomerPricing_batch_customer_unique` (`batchId`, `customerId`),
  KEY `batchCustomerPricing_batchId_idx` (`batchId`),
  KEY `batchCustomerPricing_customerId_idx` (`customerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. activityAlerts
CREATE TABLE IF NOT EXISTS `activityAlerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text,
  `entityType` varchar(50),
  `entityId` int,
  `isRead` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `activityAlerts_type_idx` (`type`),
  KEY `activityAlerts_isRead_idx` (`isRead`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. emailTemplates
CREATE TABLE IF NOT EXISTS `emailTemplates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `variables` json,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `emailTemplates_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. stockCategories
CREATE TABLE IF NOT EXISTS `stockCategories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. stockProducts
CREATE TABLE IF NOT EXISTS `stockProducts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `categoryId` int,
  `name` varchar(255) NOT NULL,
  `sku` varchar(100),
  `description` text,
  `unit` varchar(50) NOT NULL DEFAULT 'piece',
  `currentStock` decimal(10,2) NOT NULL DEFAULT '0.00',
  `minStock` decimal(10,2) NOT NULL DEFAULT '0.00',
  `costPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
  `salePrice` decimal(10,2) NOT NULL DEFAULT '0.00',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `stockProducts_categoryId_idx` (`categoryId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. stockPurchases
CREATE TABLE IF NOT EXISTS `stockPurchases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplierId` int,
  `invoiceNumber` varchar(100),
  `totalAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `paidAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `notes` text,
  `purchaseDate` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. stockPurchaseItems
CREATE TABLE IF NOT EXISTS `stockPurchaseItems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `purchaseId` int NOT NULL,
  `productId` int NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  `totalPrice` decimal(10,2) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `stockPurchaseItems_purchaseId_idx` (`purchaseId`),
  KEY `stockPurchaseItems_productId_idx` (`productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. stockSales
CREATE TABLE IF NOT EXISTS `stockSales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customerId` int,
  `invoiceNumber` varchar(100),
  `totalAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `paidAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `notes` text,
  `saleDate` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. stockSaleItems
CREATE TABLE IF NOT EXISTS `stockSaleItems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `saleId` int NOT NULL,
  `productId` int NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  `totalPrice` decimal(10,2) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `stockSaleItems_saleId_idx` (`saleId`),
  KEY `stockSaleItems_productId_idx` (`productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. stockMovements
CREATE TABLE IF NOT EXISTS `stockMovements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `productId` int NOT NULL,
  `type` varchar(50) NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `referenceType` varchar(50),
  `referenceId` int,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `stockMovements_productId_idx` (`productId`),
  KEY `stockMovements_type_idx` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
