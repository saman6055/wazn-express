ALTER TABLE `purchaseRequests` ADD `isCharged` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `chargedAt` timestamp;--> statement-breakpoint
ALTER TABLE `purchaseRequests` ADD `chargedAmount` decimal(10,2);