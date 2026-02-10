ALTER TABLE `fullPackageOrders` MODIFY COLUMN `orderType` enum('full_package','purchase_request','commission') NOT NULL DEFAULT 'full_package';--> statement-breakpoint
ALTER TABLE `fullPackageOrders` MODIFY COLUMN `status` enum('pending_quote','quoted','pending','approved','rejected','ordered','tracking_added','in_china_warehouse','quality_check','in_batch','in_transit','arrived','ready_for_delivery','delivered','cancelled','refunded','returned') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `itemPriceUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `itemPriceCny` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `commissionFeeUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `totalPrepaidUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `isPrepaid` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `prepaidAt` timestamp;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `grossProfitUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `netProfitUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `isChargedToCustomer` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `chargedAt` timestamp;--> statement-breakpoint
ALTER TABLE `packages` ADD `fullPackageOrderId` int;--> statement-breakpoint
ALTER TABLE `packages` ADD `packageOwnership` enum('customer','company') DEFAULT 'customer' NOT NULL;