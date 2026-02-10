ALTER TABLE `backups` ADD `backupContent` enum('database_only','files_only','full') DEFAULT 'database_only' NOT NULL;--> statement-breakpoint
ALTER TABLE `backups` ADD `filesZipUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `backups` ADD `filesZipSize` bigint;--> statement-breakpoint
ALTER TABLE `backups` ADD `filesCount` int;