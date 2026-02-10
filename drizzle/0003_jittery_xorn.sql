ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','employee','accountant','customer') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `customerCode` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `sequenceNumber` int;--> statement-breakpoint
ALTER TABLE `users` ADD `fullName` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `fullNameArabic` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `fullNameKurdish` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `mobileNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `country` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `address` text;--> statement-breakpoint
ALTER TABLE `users` ADD `goodsTypePreferences` json;--> statement-breakpoint
ALTER TABLE `users` ADD `shippingTypePreferences` json;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `users` ADD `createdById` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_customerCode_unique` UNIQUE(`customerCode`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_sequenceNumber_unique` UNIQUE(`sequenceNumber`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_mobileNumber_unique` UNIQUE(`mobileNumber`);