ALTER TABLE `fullPackageOrders` ADD `isShippingCharged` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `shippingChargedAt` timestamp;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `shippingChargedUsd` decimal(10,2);