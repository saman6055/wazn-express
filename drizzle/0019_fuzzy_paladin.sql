CREATE TABLE `batchCustomerPricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`customerId` int NOT NULL,
	`pricePerKg` decimal(10,2),
	`pricePerCbm` decimal(10,2),
	`notes` text,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batchCustomerPricing_id` PRIMARY KEY(`id`)
);
