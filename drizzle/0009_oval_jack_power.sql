ALTER TABLE `backups` MODIFY COLUMN `fileUrl` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `backups` MODIFY COLUMN `backupType` enum('manual','scheduled') NOT NULL DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `backups` ADD `fileKey` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `backups` ADD `schedule` enum('daily','weekly','monthly');--> statement-breakpoint
ALTER TABLE `backups` ADD `databaseName` varchar(100);--> statement-breakpoint
ALTER TABLE `backups` ADD `tablesCount` int;--> statement-breakpoint
ALTER TABLE `backups` ADD `recordsCount` int;--> statement-breakpoint
ALTER TABLE `backups` ADD `expiresAt` timestamp;