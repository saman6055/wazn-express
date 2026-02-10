ALTER TABLE `fullPackageOrders` MODIFY COLUMN `purchasePriceUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` MODIFY COLUMN `sellingPriceUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` MODIFY COLUMN `status` enum('pending','approved','ordered','tracking_added','in_china_warehouse','in_batch','in_transit','arrived','ready_for_delivery','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `orderCode` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `orderType` enum('resale','purchase') DEFAULT 'resale' NOT NULL;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `productDescription` text;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `estimatedPriceUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `actualPriceUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `purchaseFeeUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `shippingType` enum('air_regular','air_irregular','sea');--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `weightKg` decimal(10,3);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `totalCostUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `paidFromBalanceUsd` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `remainingBalanceUsd` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `isPaid` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `arrivedDate` timestamp;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `deliveredDate` timestamp;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `packageId` int;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `priority` enum('low','normal','high','urgent') DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `internalNotes` text;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `assignedToId` int;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD CONSTRAINT `fullPackageOrders_orderCode_unique` UNIQUE(`orderCode`);