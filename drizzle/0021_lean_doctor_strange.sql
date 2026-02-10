ALTER TABLE `purchaseRequests` MODIFY COLUMN `status` enum('pending','quoted','approved','rejected','admin_rejected','purchasing','purchased','in_transit','arrived','delivered','completed','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `purchaseRequests` MODIFY COLUMN `customerResponse` enum('pending','approved','rejected') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `productType` varchar(100);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `costPerItemUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `costPerItemCny` decimal(10,2);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `totalCostUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `shippingCostUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `totalExpenseUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `sellingPriceUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `profitUsd` decimal(10,2);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `profitMarginPercent` decimal(5,2);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `estimatedDeliveryDays` int;--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `invoiceId` int;--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `supplierTrackingNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `supplierOrderNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `linkedFullPackageId` int;