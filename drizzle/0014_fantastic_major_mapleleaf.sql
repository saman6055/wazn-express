CREATE TABLE `batchPricingTiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`minValue` decimal(10,4) NOT NULL,
	`maxValue` decimal(10,4),
	`pricePerUnit` decimal(10,2) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `batchPricingTiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `batches` ADD `actualWeightKg` decimal(10,2);--> statement-breakpoint
ALTER TABLE `batches` ADD `actualCbm` decimal(10,4);--> statement-breakpoint
ALTER TABLE `batches` ADD `chargedWeightKg` decimal(10,2);--> statement-breakpoint
ALTER TABLE `batches` ADD `chargedCbm` decimal(10,4);--> statement-breakpoint
ALTER TABLE `batches` ADD `costPerKg` decimal(10,2);--> statement-breakpoint
ALTER TABLE `batches` ADD `costPerCbm` decimal(10,2);--> statement-breakpoint
ALTER TABLE `batches` ADD `useTieredPricing` boolean DEFAULT false NOT NULL;