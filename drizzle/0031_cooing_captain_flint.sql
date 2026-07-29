CREATE TABLE `customerDeclaredPackages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`trackingNumber` varchar(100) NOT NULL,
	`platform` enum('taobao','pinduoduo','alibaba','1688','aliexpress','weixin','other'),
	`productName` varchar(255),
	`productImages` json,
	`categoryId` int,
	`notes` text,
	`purchaseDate` timestamp,
	`status` enum('pending','matched','received','cancelled') NOT NULL DEFAULT 'pending',
	`matchedPackageId` int,
	`matchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerDeclaredPackages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliveryBoxItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boxId` int NOT NULL,
	`packageId` int,
	`fullPackageOrderId` int,
	`trackingNumber` varchar(100),
	`packageCode` varchar(50),
	`description` text,
	`weightKg` decimal(10,3),
	`calculatedCostUsd` decimal(10,2),
	`itemType` enum('regular','full_package','commission') NOT NULL DEFAULT 'regular',
	`sourceInfo` varchar(255),
	`scannedAt` timestamp NOT NULL DEFAULT (now()),
	`scannedById` int NOT NULL,
	CONSTRAINT `deliveryBoxItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliveryBoxes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boxCode` varchar(50) NOT NULL,
	`customerId` int NOT NULL,
	`batchId` int,
	`deliveryMethod` enum('warehouse_pickup','home_delivery','city_transfer') NOT NULL DEFAULT 'warehouse_pickup',
	`destinationCity` varchar(100),
	`destinationAddress` text,
	`recipientName` varchar(255),
	`recipientPhone` varchar(20),
	`deliveryCostUsd` decimal(10,2) DEFAULT '0',
	`deliveryChargeUsd` decimal(10,2) DEFAULT '0',
	`deliveryProfitUsd` decimal(10,2) DEFAULT '0',
	`totalPackages` int NOT NULL DEFAULT 0,
	`totalWeightKg` decimal(10,3) DEFAULT '0',
	`totalValueUsd` decimal(10,2) DEFAULT '0',
	`status` enum('open','ready','in_transit','delivered','cancelled') NOT NULL DEFAULT 'open',
	`signature` text,
	`deliveryPhoto` text,
	`invoiceId` int,
	`isCharged` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdById` int NOT NULL,
	`sealedById` int,
	`deliveredById` int,
	`sealedAt` timestamp,
	`inTransitAt` timestamp,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deliveryBoxes_id` PRIMARY KEY(`id`),
	CONSTRAINT `deliveryBoxes_boxCode_unique` UNIQUE(`boxCode`)
);
--> statement-breakpoint
CREATE TABLE `packageOrderLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`fullPackageOrderId` int NOT NULL,
	`cartonIndex` int NOT NULL DEFAULT 1,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `packageOrderLinks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fullPackageOrderTrackings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullPackageOrderId` int NOT NULL,
	`trackingNumber` varchar(100) NOT NULL,
	`cartonIndex` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fullPackageOrderTrackings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portalPriceListSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`titleKu` varchar(200),
	`titleEn` varchar(200),
	`titleAr` varchar(200),
	`titleZh` varchar(200),
	`subtitleKu` varchar(400),
	`subtitleEn` varchar(400),
	`subtitleAr` varchar(400),
	`subtitleZh` varchar(400),
	`showShippingRates` boolean NOT NULL DEFAULT true,
	`showServices` boolean NOT NULL DEFAULT true,
	`showRmbEquivalent` boolean NOT NULL DEFAULT true,
	`showIqdEquivalent` boolean NOT NULL DEFAULT false,
	`layoutVariant` enum('tabs','stacked','compact') NOT NULL DEFAULT 'tabs',
	`position` enum('top','belowHeader','belowStats') NOT NULL DEFAULT 'belowHeader',
	`accentColor` varchar(30) NOT NULL DEFAULT 'purple',
	`disclaimerKu` text,
	`disclaimerEn` text,
	`disclaimerAr` text,
	`disclaimerZh` text,
	`updatedById` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portalPriceListSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productAttributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('color','size','productType') NOT NULL,
	`value` varchar(200) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productAttributes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `batchLabelTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`size` enum('10x15','10x10','A6','A5','custom') NOT NULL DEFAULT '10x15',
	`widthMm` int DEFAULT 100,
	`heightMm` int DEFAULT 150,
	`showQrCode` boolean NOT NULL DEFAULT true,
	`qrCodeSize` int DEFAULT 80,
	`qrCodePosition` enum('top-left','top-right','bottom-left','bottom-right','center') DEFAULT 'top-right',
	`showBarcode` boolean NOT NULL DEFAULT true,
	`barcodeType` enum('code128','code39','ean13','qr') DEFAULT 'code128',
	`showLogo` boolean NOT NULL DEFAULT true,
	`logoUrl` varchar(500),
	`logoWidth` int DEFAULT 60,
	`showCustomerName` boolean NOT NULL DEFAULT true,
	`showCustomerCode` boolean NOT NULL DEFAULT true,
	`showTotalPackages` boolean NOT NULL DEFAULT true,
	`showTotalWeight` boolean NOT NULL DEFAULT true,
	`showTotalVolume` boolean NOT NULL DEFAULT true,
	`showTotalPrice` boolean NOT NULL DEFAULT true,
	`showBatchNumber` boolean NOT NULL DEFAULT true,
	`showDate` boolean NOT NULL DEFAULT true,
	`primaryColor` varchar(7) DEFAULT '#059669',
	`fontFamily` varchar(100) DEFAULT 'Arial',
	`fontSize` int DEFAULT 12,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batchLabelTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `storeOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderCode` varchar(50) NOT NULL,
	`productId` int,
	`productName` varchar(300) NOT NULL,
	`productImageUrl` varchar(500),
	`unitPrice` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`totalPrice` decimal(10,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`customerName` varchar(200) NOT NULL,
	`customerPhone` varchar(50) NOT NULL,
	`customerCity` varchar(100),
	`customerAddress` text,
	`note` text,
	`status` enum('new','confirmed','preparing','shipped','delivered','cancelled') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storeOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `storeOrders_orderCode_unique` UNIQUE(`orderCode`)
);
--> statement-breakpoint
CREATE TABLE `storeProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameEn` varchar(300) NOT NULL,
	`nameKu` varchar(300),
	`nameAr` varchar(300),
	`descriptionEn` text,
	`descriptionKu` text,
	`descriptionAr` text,
	`price` decimal(10,2) NOT NULL,
	`compareAtPrice` decimal(10,2),
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`coverImageUrl` varchar(500),
	`images` json,
	`category` varchar(100),
	`status` enum('active','hidden','out_of_stock') NOT NULL DEFAULT 'active',
	`stock` int,
	`slug` varchar(255),
	`isFeatured` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`viewCount` int NOT NULL DEFAULT 0,
	`orderCount` int NOT NULL DEFAULT 0,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storeProducts_id` PRIMARY KEY(`id`),
	CONSTRAINT `storeProducts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `prohibitedPackages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`trackingNumber` varchar(100) NOT NULL,
	`photos` json,
	`reasonId` varchar(120),
	`reasonNote` text,
	`resolutionChoice` enum('return','reship','destroy'),
	`reshipAddress` text,
	`resolutionChosenAt` timestamp,
	`viewedByCustomerAt` timestamp,
	`feeUsd` decimal(10,2),
	`chargedAt` timestamp,
	`ledgerTransactionId` int,
	`status` enum('pending','chosen','resolved','cancelled') NOT NULL DEFAULT 'pending',
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prohibitedPackages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`userAgent` varchar(500),
	`platform` varchar(50),
	`language` varchar(10),
	`isActive` boolean NOT NULL DEFAULT true,
	`failureCount` int NOT NULL DEFAULT 0,
	`lastUsedAt` timestamp,
	`lastFailedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_push_subscriptions_endpoint_unique` UNIQUE(`endpoint`)
);
--> statement-breakpoint
CREATE TABLE `push_notification_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titleKu` varchar(200),
	`titleEn` varchar(200),
	`titleAr` varchar(200),
	`titleZh` varchar(200),
	`bodyKu` text,
	`bodyEn` text,
	`bodyAr` text,
	`bodyZh` text,
	`url` varchar(500),
	`targetType` enum('all','customer','batch','segment') NOT NULL,
	`targetCustomerId` int,
	`targetBatchId` int,
	`targetSegment` enum('active_customers','with_pending_packages','with_unpaid_invoices','vip_customers','inactive_30d'),
	`status` enum('draft','scheduled','sending','completed','failed','cancelled') NOT NULL DEFAULT 'draft',
	`scheduledAt` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`totalRecipients` int NOT NULL DEFAULT 0,
	`sentCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`expiredRemovedCount` int NOT NULL DEFAULT 0,
	`createdById` int NOT NULL,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `push_notification_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customerActivityLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`action` varchar(60) NOT NULL,
	`category` enum('auth','navigation','declaration','claim','message','search','profile','other') NOT NULL DEFAULT 'other',
	`entityType` varchar(50),
	`entityId` int,
	`path` varchar(255),
	`detail` varchar(500),
	`metadata` json,
	`ipAddress` varchar(64),
	`userAgent` varchar(400),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerActivityLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customerAdminNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`note` varchar(2000) NOT NULL,
	`createdById` int NOT NULL,
	`createdByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerAdminNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliveryRatings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`packageId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deliveryRatings_id` PRIMARY KEY(`id`),
	CONSTRAINT `deliveryRatings_packageId_unique` UNIQUE(`packageId`)
);
--> statement-breakpoint
CREATE TABLE `yuanExchangeOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`usdAmount` decimal(12,2) NOT NULL,
	`cnyAmount` decimal(12,2) NOT NULL,
	`rate` decimal(10,4) NOT NULL,
	`status` enum('pending','processing','completed','cancelled') NOT NULL DEFAULT 'pending',
	`customerNote` varchar(1000),
	`adminNote` varchar(1000),
	`handledById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `yuanExchangeOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `fullPackageOrders` DROP INDEX `fullPackageOrders_trackingNumber_unique`;--> statement-breakpoint
ALTER TABLE `chat_messages` MODIFY COLUMN `messageType` enum('text','image','file','system','voice') NOT NULL DEFAULT 'text';--> statement-breakpoint
ALTER TABLE `blogPosts` ADD `isPinned` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `serviceTypes` json;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `productType` varchar(200);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `advancePaidUsd` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `advancePaidAt` timestamp;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `advancePaymentMethod` enum('CASH','BANK_TRANSFER','FIB','FASTPAY','ZAINCASH','ASIAHAWALA','CARD','OTHER');--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `advancePaymentTransactionId` int;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `trackingNumbers` json;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `chargeTransactionId` int;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `deletedById` int;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `deletionReason` text;--> statement-breakpoint
ALTER TABLE `packageClaimRequests` ADD `proofImages` json;--> statement-breakpoint
ALTER TABLE `paymentRecords` ADD `reversedAmountUsd` decimal(10,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `paymentRecords` ADD `reversedAt` timestamp;--> statement-breakpoint
ALTER TABLE `paymentRecords` ADD `reversalTransactionId` int;--> statement-breakpoint
ALTER TABLE `pricingRules` ADD `showOnPortal` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pricingRules` ADD `portalLabelKu` varchar(150);--> statement-breakpoint
ALTER TABLE `pricingRules` ADD `portalLabelEn` varchar(150);--> statement-breakpoint
ALTER TABLE `pricingRules` ADD `portalLabelAr` varchar(150);--> statement-breakpoint
ALTER TABLE `pricingRules` ADD `portalLabelZh` varchar(150);--> statement-breakpoint
ALTER TABLE `pricingRules` ADD `portalIcon` varchar(50);--> statement-breakpoint
ALTER TABLE `pricingRules` ADD `portalColor` varchar(30);--> statement-breakpoint
ALTER TABLE `pricingRules` ADD `portalBadge` varchar(30);--> statement-breakpoint
ALTER TABLE `pricingRules` ADD `portalSortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD `showOnPortal` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD `portalDescriptionKu` text;--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD `portalDescriptionEn` text;--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD `portalDescriptionAr` text;--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD `portalDescriptionZh` text;--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD `portalBadge` varchar(30);--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD `portalPriceLabelKu` varchar(100);--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD `portalPriceLabelEn` varchar(100);--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD `portalPriceLabelAr` varchar(100);--> statement-breakpoint
ALTER TABLE `serviceTypes` ADD `portalPriceLabelZh` varchar(100);--> statement-breakpoint
CREATE INDEX `idx_cdp_tracking` ON `customerDeclaredPackages` (`trackingNumber`);--> statement-breakpoint
CREATE INDEX `idx_cdp_customer` ON `customerDeclaredPackages` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_cdp_status` ON `customerDeclaredPackages` (`status`);--> statement-breakpoint
CREATE INDEX `idx_delivery_boxes_batch_id` ON `deliveryBoxes` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_delivery_boxes_customer_id` ON `deliveryBoxes` (`customerId`);--> statement-breakpoint
CREATE INDEX `uniq_pol_pkg_order` ON `packageOrderLinks` (`packageId`,`fullPackageOrderId`);--> statement-breakpoint
CREATE INDEX `idx_pol_package_id` ON `packageOrderLinks` (`packageId`);--> statement-breakpoint
CREATE INDEX `idx_pol_order_id` ON `packageOrderLinks` (`fullPackageOrderId`);--> statement-breakpoint
CREATE INDEX `idx_fpot_order_id` ON `fullPackageOrderTrackings` (`fullPackageOrderId`);--> statement-breakpoint
CREATE INDEX `idx_fpot_tracking_number` ON `fullPackageOrderTrackings` (`trackingNumber`);--> statement-breakpoint
CREATE INDEX `storeOrders_status_idx` ON `storeOrders` (`status`);--> statement-breakpoint
CREATE INDEX `storeOrders_product_idx` ON `storeOrders` (`productId`);--> statement-breakpoint
CREATE INDEX `storeOrders_created_idx` ON `storeOrders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `storeProducts_status_idx` ON `storeProducts` (`status`);--> statement-breakpoint
CREATE INDEX `prohibitedPackages_customer_idx` ON `prohibitedPackages` (`customerId`);--> statement-breakpoint
CREATE INDEX `prohibitedPackages_status_idx` ON `prohibitedPackages` (`status`);--> statement-breakpoint
CREATE INDEX `customerPushSubscriptions_customerId_idx` ON `customer_push_subscriptions` (`customerId`);--> statement-breakpoint
CREATE INDEX `customerPushSubscriptions_active_idx` ON `customer_push_subscriptions` (`isActive`);--> statement-breakpoint
CREATE INDEX `pushCampaigns_status_idx` ON `push_notification_campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `pushCampaigns_scheduled_idx` ON `push_notification_campaigns` (`scheduledAt`);--> statement-breakpoint
CREATE INDEX `pushCampaigns_created_idx` ON `push_notification_campaigns` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_cal_customer` ON `customerActivityLog` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_cal_action` ON `customerActivityLog` (`action`);--> statement-breakpoint
CREATE INDEX `idx_cal_created` ON `customerActivityLog` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_can_customer` ON `customerAdminNotes` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_dr_customer` ON `deliveryRatings` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_dr_rating` ON `deliveryRatings` (`rating`);--> statement-breakpoint
CREATE INDEX `idx_yeo_customer` ON `yuanExchangeOrders` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_yeo_status` ON `yuanExchangeOrders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_yeo_created` ON `yuanExchangeOrders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_batch_customer_pricing` ON `batchCustomerPricing` (`batchId`,`customerId`);--> statement-breakpoint
CREATE INDEX `idx_batch_pricing_tiers_batch_id` ON `batchPricingTiers` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_batches_status` ON `batches` (`status`);--> statement-breakpoint
CREATE INDEX `idx_batches_shipping_type` ON `batches` (`shippingType`);--> statement-breakpoint
CREATE INDEX `idx_batches_created_at` ON `batches` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_cash_txn_account_id` ON `cashTransactions` (`accountId`);--> statement-breakpoint
CREATE INDEX `idx_cust_msg_customer_created` ON `customerMessages` (`customerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_cust_notif_customer_created` ON `customerNotifications` (`customerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_customers_customer_code` ON `customers` (`customerCode`);--> statement-breakpoint
CREATE INDEX `idx_customers_mobile_number` ON `customers` (`mobileNumber`);--> statement-breakpoint
CREATE INDEX `idx_expenses_expense_date` ON `expenses` (`expenseDate`);--> statement-breakpoint
CREATE INDEX `idx_expenses_category_id` ON `expenses` (`categoryId`);--> statement-breakpoint
CREATE INDEX `idx_fpo_deleted_at` ON `fullPackageOrders` (`deletedAt`);--> statement-breakpoint
CREATE INDEX `idx_fpo_charge_txn_id` ON `fullPackageOrders` (`chargeTransactionId`);--> statement-breakpoint
CREATE INDEX `idx_fpo_customer_id` ON `fullPackageOrders` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_fpo_tracking_number` ON `fullPackageOrders` (`trackingNumber`);--> statement-breakpoint
CREATE INDEX `idx_fpo_batch_id` ON `fullPackageOrders` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_fpo_status` ON `fullPackageOrders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_invoices_customer_id` ON `invoices` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_invoices_batch_id` ON `invoices` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_invoices_created_at` ON `invoices` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_invoices_status` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ledger_account_id` ON `ledgerTransactions` (`accountId`);--> statement-breakpoint
CREATE INDEX `idx_ledger_created_at` ON `ledgerTransactions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_ledger_transaction_type` ON `ledgerTransactions` (`transactionType`);--> statement-breakpoint
CREATE INDEX `idx_ledger_account_created` ON `ledgerTransactions` (`accountId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_ledger_account_created_type` ON `ledgerTransactions` (`accountId`,`createdAt`,`transactionType`);--> statement-breakpoint
CREATE INDEX `idx_packages_customer_id` ON `packages` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_packages_batch_id` ON `packages` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_packages_status` ON `packages` (`status`);--> statement-breakpoint
CREATE INDEX `idx_packages_tracking_number` ON `packages` (`trackingNumber`);--> statement-breakpoint
CREATE INDEX `idx_packages_created_at` ON `packages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_payment_records_account_id` ON `paymentRecords` (`accountId`);--> statement-breakpoint
CREATE INDEX `idx_revenue_records_record_date` ON `revenueRecords` (`recordDate`);--> statement-breakpoint
CREATE INDEX `idx_revenue_records_customer_id` ON `revenueRecords` (`customerId`);