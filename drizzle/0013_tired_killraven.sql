ALTER TABLE `packages` MODIFY COLUMN `customerId` int;--> statement-breakpoint
ALTER TABLE `packages` ADD `isUnclaimed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` ADD `claimedAt` timestamp;--> statement-breakpoint
ALTER TABLE `packages` ADD `claimedById` int;