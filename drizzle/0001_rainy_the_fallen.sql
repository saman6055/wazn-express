CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userRole` varchar(20),
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int,
	`oldValues` json,
	`newValues` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchCode` varchar(50) NOT NULL,
	`originWarehouseId` int NOT NULL,
	`destinationCountryId` int NOT NULL,
	`shippingType` enum('air_regular','air_irregular','sea') NOT NULL,
	`carrierInfo` varchar(255),
	`departureDate` timestamp,
	`estimatedArrival` timestamp,
	`actualArrival` timestamp,
	`status` enum('preparing','in_transit','arrived','customs','delivered','closed') NOT NULL DEFAULT 'preparing',
	`totalPackages` int NOT NULL DEFAULT 0,
	`totalWeight` decimal(10,2),
	`notes` text,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `batches_batchCode_unique` UNIQUE(`batchCode`)
);
--> statement-breakpoint
CREATE TABLE `countries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameEn` varchar(100) NOT NULL,
	`nameAr` varchar(100),
	`nameKu` varchar(100),
	`nameZh` varchar(100),
	`nameTr` varchar(100),
	`nameFa` varchar(100),
	`isoCode` varchar(3) NOT NULL,
	`defaultCurrency` varchar(3),
	`isActive` boolean NOT NULL DEFAULT true,
	`isOrigin` boolean NOT NULL DEFAULT false,
	`isDestination` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `countries_id` PRIMARY KEY(`id`),
	CONSTRAINT `countries_isoCode_unique` UNIQUE(`isoCode`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerCode` varchar(100) NOT NULL,
	`sequenceNumber` int NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`fullNameArabic` varchar(255),
	`fullNameKurdish` varchar(255),
	`mobileNumber` varchar(20) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`email` varchar(320),
	`country` varchar(100),
	`city` varchar(100),
	`address` text,
	`goodsTypePreferences` json,
	`shippingTypePreferences` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_customerCode_unique` UNIQUE(`customerCode`),
	CONSTRAINT `customers_sequenceNumber_unique` UNIQUE(`sequenceNumber`),
	CONSTRAINT `customers_mobileNumber_unique` UNIQUE(`mobileNumber`)
);
--> statement-breakpoint
CREATE TABLE `exchangeRates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`baseCurrency` varchar(3) NOT NULL DEFAULT 'USD',
	`targetCurrency` varchar(3) NOT NULL,
	`rate` decimal(15,6) NOT NULL,
	`source` varchar(50),
	`isManualOverride` boolean NOT NULL DEFAULT false,
	`effectiveFrom` timestamp NOT NULL DEFAULT (now()),
	`effectiveTo` timestamp,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchangeRates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(50) NOT NULL,
	`customerId` int NOT NULL,
	`packageId` int,
	`batchId` int,
	`subtotalUsd` decimal(12,2) NOT NULL,
	`taxUsd` decimal(12,2) DEFAULT '0',
	`totalUsd` decimal(12,2) NOT NULL,
	`exchangeRateIqd` decimal(12,2),
	`exchangeRateRmb` decimal(12,6),
	`totalIqd` decimal(15,0),
	`totalRmb` decimal(12,2),
	`status` enum('draft','issued','paid','partially_paid','cancelled','refunded') NOT NULL DEFAULT 'draft',
	`issuedAt` timestamp,
	`dueDate` timestamp,
	`paidAt` timestamp,
	`pdfUrl` text,
	`lineItems` json,
	`notes` text,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `ledgerEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`entryType` enum('charge','payment','refund','adjustment') NOT NULL,
	`amountUsd` decimal(12,2) NOT NULL,
	`balanceAfterUsd` decimal(12,2) NOT NULL,
	`description` text,
	`referenceType` varchar(50),
	`referenceId` int,
	`packageId` int,
	`invoiceId` int,
	`paymentMethod` varchar(50),
	`exchangeRateUsed` decimal(12,6),
	`originalCurrency` varchar(3),
	`originalAmount` decimal(12,2),
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ledgerEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int,
	`channel` enum('email','whatsapp','sms') NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`recipient` varchar(255) NOT NULL,
	`subject` varchar(500),
	`content` text,
	`status` enum('pending','sent','failed','delivered') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificationLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageCode` varchar(50) NOT NULL,
	`trackingNumber` varchar(100),
	`customerId` int NOT NULL,
	`originWarehouseId` int NOT NULL,
	`batchId` int,
	`qrCodeData` text,
	`qrCodeSignature` varchar(255),
	`weightKg` decimal(10,3),
	`lengthCm` decimal(10,2),
	`widthCm` decimal(10,2),
	`heightCm` decimal(10,2),
	`volumeCbm` decimal(10,6),
	`shippingType` enum('air_regular','air_irregular','sea') NOT NULL,
	`description` text,
	`photos` json,
	`calculatedCostUsd` decimal(10,2),
	`appliedPricingRuleId` int,
	`status` enum('registered','in_batch','in_transit','customs_processing','ready_for_delivery','out_for_delivery','delivered','returned','cancelled') NOT NULL DEFAULT 'registered',
	`registeredAt` timestamp NOT NULL DEFAULT (now()),
	`registeredById` int NOT NULL,
	`deliveredAt` timestamp,
	`deliveredById` int,
	`recipientName` varchar(255),
	`recipientSignature` text,
	`deliveryPhoto` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `packages_packageCode_unique` UNIQUE(`packageCode`)
);
--> statement-breakpoint
CREATE TABLE `pricingRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originCountryId` int NOT NULL,
	`originWarehouseId` int,
	`destinationCountryId` int NOT NULL,
	`shippingType` enum('air_regular','air_irregular','sea') NOT NULL,
	`pricePerUnit` decimal(10,2) NOT NULL,
	`unit` enum('kg','cbm') NOT NULL,
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricingRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `systemSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text,
	`settingType` varchar(20) DEFAULT 'string',
	`description` text,
	`updatedById` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `systemSettings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameEn` varchar(200) NOT NULL,
	`nameAr` varchar(200),
	`nameKu` varchar(200),
	`nameZh` varchar(200),
	`nameTr` varchar(200),
	`nameFa` varchar(200),
	`countryId` int NOT NULL,
	`city` varchar(100) NOT NULL,
	`addressEn` text,
	`addressAr` text,
	`addressKu` text,
	`warehouseType` enum('air','sea','custom') NOT NULL,
	`codePrefix` varchar(10) NOT NULL,
	`expectedDeliveryMin` int,
	`expectedDeliveryMax` int,
	`pricingModel` enum('per_kg','per_cbm') NOT NULL,
	`contactInfo` text,
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','employee','accountant') NOT NULL DEFAULT 'user';