CREATE TABLE `productCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameEn` varchar(100) NOT NULL,
	`nameAr` varchar(100),
	`nameKu` varchar(100),
	`icon` varchar(50),
	`color` varchar(20),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `batches` ADD `pricePerKg` decimal(10,2);--> statement-breakpoint
ALTER TABLE `batches` ADD `pricePerCbm` decimal(10,2);--> statement-breakpoint
ALTER TABLE `packages` ADD `categoryId` int;